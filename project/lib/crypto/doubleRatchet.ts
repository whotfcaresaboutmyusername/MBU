import { hkdf } from './hkdf';
import { getSodium, UTF8, UTF8_DECODER } from './sodium';
import type { EncryptedPayload, RatchetState, RatchetHeader } from './types';

interface RuntimeKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface RuntimeRatchetKey {
  publicKey: Uint8Array;
  encoded: string;
}

interface RuntimeState {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousSendingMessageNumber: number;
  localRatchetKey: RuntimeKeyPair;
  remoteRatchetKey: RuntimeRatchetKey | null;
}

const concat = (first: Uint8Array, second: Uint8Array): Uint8Array => {
  const result = new Uint8Array(first.length + second.length);
  result.set(first, 0);
  result.set(second, first.length);
  return result;
};

const encode = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  input: Uint8Array
): string => sodium.to_base64(input, sodium.base64_variants.URLSAFE_NO_PADDING);

const decode = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  value: string
): Uint8Array =>
  sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);

const decodeState = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  state: RatchetState
): RuntimeState => ({
  rootKey: decode(sodium, state.rootKey),
  sendingChainKey: decode(sodium, state.sendingChainKey),
  receivingChainKey: decode(sodium, state.receivingChainKey),
  sendingMessageNumber: state.sendingMessageNumber,
  receivingMessageNumber: state.receivingMessageNumber,
  previousSendingMessageNumber: state.previousSendingMessageNumber,
  localRatchetKey: {
    publicKey: decode(sodium, state.localRatchetKey.publicKey),
    privateKey: decode(sodium, state.localRatchetKey.privateKey),
  },
  remoteRatchetKey: state.remoteRatchetKey
    ? {
        publicKey: decode(sodium, state.remoteRatchetKey),
        encoded: state.remoteRatchetKey,
      }
    : null,
});

const encodeState = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  state: RuntimeState
): RatchetState => ({
  rootKey: encode(sodium, state.rootKey),
  sendingChainKey: encode(sodium, state.sendingChainKey),
  receivingChainKey: encode(sodium, state.receivingChainKey),
  sendingMessageNumber: state.sendingMessageNumber,
  receivingMessageNumber: state.receivingMessageNumber,
  previousSendingMessageNumber: state.previousSendingMessageNumber,
  localRatchetKey: {
    publicKey: encode(sodium, state.localRatchetKey.publicKey),
    privateKey: encode(sodium, state.localRatchetKey.privateKey),
  },
  remoteRatchetKey: state.remoteRatchetKey?.encoded ?? null,
});

const kdfRoot = async (
  rootKey: Uint8Array,
  dhOutput: Uint8Array
): Promise<{ rootKey: Uint8Array; chainKey: Uint8Array }> => {
  const input = concat(rootKey, dhOutput);
  const derived = await hkdf(input, 'DoubleRatchetRoot', 64);
  return {
    rootKey: derived.slice(0, 32),
    chainKey: derived.slice(32, 64),
  };
};

const kdfChain = async (
  chainKey: Uint8Array
): Promise<{ chainKey: Uint8Array; messageKey: Uint8Array }> => {
  const derived = await hkdf(chainKey, 'DoubleRatchetChain', 64);
  return {
    chainKey: derived.slice(0, 32),
    messageKey: derived.slice(32, 64),
  };
};

export class DoubleRatchet {
  private constructor(
    private readonly sodium: Awaited<ReturnType<typeof getSodium>>,
    private readonly state: RuntimeState
  ) {}

  static async fromState(state: RatchetState): Promise<DoubleRatchet> {
    const sodium = await getSodium();
    const runtime = decodeState(sodium, state);
    return new DoubleRatchet(sodium, runtime);
  }

  async getState(): Promise<RatchetState> {
    return encodeState(this.sodium, this.state);
  }

  private async ratchetStep(remotePublicKey: Uint8Array) {
    const { rootKey: newRoot, chainKey: receivingChain } = await kdfRoot(
      this.state.rootKey,
      this.sodium.crypto_scalarmult(
        this.state.localRatchetKey.privateKey,
        remotePublicKey
      )
    );

    this.state.rootKey = newRoot;
    this.state.receivingChainKey = receivingChain;
    this.state.receivingMessageNumber = 0;
    this.state.previousSendingMessageNumber = this.state.sendingMessageNumber;
    this.state.sendingMessageNumber = 0;
    this.state.remoteRatchetKey = {
      publicKey: remotePublicKey,
      encoded: encode(this.sodium, remotePublicKey),
    };

    const freshPair = this.sodium.crypto_kx_keypair();
    const { rootKey: finalRoot, chainKey: sendingChain } = await kdfRoot(
      this.state.rootKey,
      this.sodium.crypto_scalarmult(freshPair.privateKey, remotePublicKey)
    );

    this.state.rootKey = finalRoot;
    this.state.sendingChainKey = sendingChain;
    this.state.localRatchetKey = {
      publicKey: freshPair.publicKey,
      privateKey: freshPair.privateKey,
    };
  }

  private ensureRemoteKey(header: RatchetHeader) {
    if (!header.ratchetKey || header.ratchetKey.length === 0) {
      throw new Error('Ratchet header missing sender key');
    }
  }

  async encrypt(
    plaintext: string,
    associatedData?: string
  ): Promise<{ payload: EncryptedPayload; messageKey: string }> {
    if (!this.state.remoteRatchetKey) {
      throw new Error('Remote ratchet key is unavailable; X3DH handshake required');
    }

    const { chainKey, messageKey } = await kdfChain(this.state.sendingChainKey);
    this.state.sendingChainKey = chainKey;

    const nonce = this.sodium.randombytes_buf(
      this.sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
    );
    const plaintextBytes = UTF8.encode(plaintext);
    const adBytes = associatedData ? UTF8.encode(associatedData) : undefined;
    const ciphertext = this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintextBytes,
      adBytes,
      null,
      nonce,
      messageKey
    );

    const header: RatchetHeader = {
      ratchetKey: encode(this.sodium, this.state.localRatchetKey.publicKey),
      messageNumber: this.state.sendingMessageNumber,
      previousSendingNumber: this.state.previousSendingMessageNumber,
      nonce: encode(this.sodium, nonce),
    };

    const encodedMessageKey = encode(this.sodium, messageKey);
    if (__DEV__) {
      console.log('[DoubleRatchet] encrypt derived message key preview:', encodedMessageKey.slice(0, 16));
    }
    this.state.sendingMessageNumber += 1;

    return {
      payload: {
        header,
        ciphertext: encode(this.sodium, ciphertext),
        associatedData,
      },
      messageKey: encodedMessageKey,
    };
  }

  private decryptWithKey(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    messageKey: Uint8Array,
    associatedData?: string
  ): string {
    const adBytes = associatedData ? UTF8.encode(associatedData) : undefined;
    const plaintext = this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      adBytes,
      nonce,
      messageKey
    );

    if (!plaintext) {
      throw new Error('Decryption failed: invalid ciphertext or key');
    }

    return UTF8_DECODER.decode(plaintext);
  }

  async decryptIncoming(
    payload: EncryptedPayload
  ): Promise<{
    plaintext: string;
    messageKey: string;
    skippedMessageKeys?: Array<{
      ratchetKey: string;
      messageNumber: number;
      key: string;
    }>;
  }> {
    const { header } = payload;
    this.ensureRemoteKey(header);

    const remotePublicKey = decode(this.sodium, header.ratchetKey);
    const skippedMessageKeys: Array<{
      ratchetKey: string;
      messageNumber: number;
      key: string;
    }> = [];

    if (
      !this.state.remoteRatchetKey ||
      this.state.remoteRatchetKey.encoded !== header.ratchetKey
    ) {
      await this.ratchetStep(remotePublicKey);
    }

    if (header.messageNumber < this.state.receivingMessageNumber) {
      throw new Error('Message number has already been processed');
    }

    while (this.state.receivingMessageNumber < header.messageNumber) {
      const currentMessageNumber = this.state.receivingMessageNumber;
      const { chainKey, messageKey } = await kdfChain(this.state.receivingChainKey);
      this.state.receivingChainKey = chainKey;
      skippedMessageKeys.push({
        ratchetKey: header.ratchetKey,
        messageNumber: currentMessageNumber,
        key: encode(this.sodium, messageKey),
      });
      this.state.receivingMessageNumber = currentMessageNumber + 1;
    }

    const currentMessageNumber = this.state.receivingMessageNumber;
    const { chainKey, messageKey } = await kdfChain(this.state.receivingChainKey);
    this.state.receivingChainKey = chainKey;
    this.state.receivingMessageNumber = currentMessageNumber + 1;

    const nonce = decode(this.sodium, header.nonce);
    const ciphertext = decode(this.sodium, payload.ciphertext);

    try {
      const plaintext = this.decryptWithKey(
        ciphertext,
        nonce,
        messageKey,
        payload.associatedData
      );

      if (__DEV__) {
        console.log('[DoubleRatchet] decryptIncoming derived message key preview:', encode(this.sodium, messageKey).slice(0, 16));
      }

      return {
        plaintext,
        messageKey: encode(this.sodium, messageKey),
        skippedMessageKeys,
      };
    } catch (error) {
      throw new Error('Failed to decrypt message payload');
    }
  }

  async decryptWithKnownKey(
    payload: EncryptedPayload,
    encodedMessageKey: string
  ): Promise<string> {
    const nonce = decode(this.sodium, payload.header.nonce);
    const ciphertext = decode(this.sodium, payload.ciphertext);
    const messageKey = decode(this.sodium, encodedMessageKey);

    try {
      return this.decryptWithKey(
        ciphertext,
        nonce,
        messageKey,
        payload.associatedData
      );
    } catch (error) {
      throw new Error('Failed to decrypt message with cached key');
    }
  }
}
