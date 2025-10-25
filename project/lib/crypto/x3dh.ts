import { hkdf } from './hkdf';
import { getSodium } from './sodium';
import type {
  DeviceKeyBundle,
  KeyPair,
  RatchetState,
  StoredDeviceKeys,
  SigningKeyPair,
} from './types';

const ONE_TIME_PREKEY_DEFAULT = 10;

const concat = (buffers: Uint8Array[]): Uint8Array => {
  const total = buffers.reduce((sum, current) => sum + current.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;

  for (const buffer of buffers) {
    combined.set(buffer, offset);
    offset += buffer.length;
  }

  return combined;
};

const encode = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  buffer: Uint8Array
): string =>
  sodium.to_base64(buffer, sodium.base64_variants.URLSAFE_NO_PADDING);

const decode = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  value: string
): Uint8Array =>
  sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);

const toKeyPair = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  pair: { publicKey: Uint8Array; privateKey: Uint8Array }
): KeyPair => ({
  publicKey: encode(sodium, pair.publicKey),
  privateKey: encode(sodium, pair.privateKey),
});

const toOneTimePreKeys = (
  sodium: Awaited<ReturnType<typeof getSodium>>,
  count: number
): KeyPair[] => {
  const keys: KeyPair[] = [];

  for (let i = 0; i < count; i++) {
    const pair = sodium.crypto_kx_keypair();
    keys.push(toKeyPair(sodium, pair));
  }

  return keys;
};

export interface GeneratedDeviceKeys extends StoredDeviceKeys {
  bundle: DeviceKeyBundle;
}

export async function generateDeviceKeys(
  deviceLabel: string,
  oneTimePreKeyCount = ONE_TIME_PREKEY_DEFAULT
): Promise<GeneratedDeviceKeys> {
  const sodium = await getSodium();
  const signingKeyPair = sodium.crypto_sign_keypair();
  const identityPublic = sodium.crypto_sign_ed25519_pk_to_curve25519(
    signingKeyPair.publicKey
  );
  const identityPrivate = sodium.crypto_sign_ed25519_sk_to_curve25519(
    signingKeyPair.privateKey
  );
  const signedPreKeyPair = sodium.crypto_kx_keypair();
  const oneTimePreKeys = toOneTimePreKeys(sodium, oneTimePreKeyCount);

  const signedPreKeySignature = encode(
    sodium,
    sodium.crypto_sign_detached(
      signedPreKeyPair.publicKey,
      signingKeyPair.privateKey
    )
  );

  const storedKeys: StoredDeviceKeys = {
    identityKey: {
      publicKey: encode(sodium, identityPublic),
      privateKey: encode(sodium, identityPrivate),
    },
    identitySigningKey: {
      publicKey: encode(sodium, signingKeyPair.publicKey),
      privateKey: encode(sodium, signingKeyPair.privateKey),
    },
    signedPreKey: toKeyPair(sodium, signedPreKeyPair),
    signedPreKeySignature,
    oneTimePreKeys,
    deviceLabel,
  };

  const bundle: DeviceKeyBundle = {
    identityKey: storedKeys.identityKey.publicKey,
    identitySigningKey: storedKeys.identitySigningKey.publicKey,
    signedPreKey: storedKeys.signedPreKey.publicKey,
    signedPreKeySignature,
    oneTimePreKeys: oneTimePreKeys.map((key) => key.publicKey),
    deviceLabel,
  };

  return { ...storedKeys, bundle };
}

export async function deviceBundleFromStoredKeys(
  stored: StoredDeviceKeys
): Promise<DeviceKeyBundle> {
  return {
    identityKey: stored.identityKey.publicKey,
    identitySigningKey: stored.identitySigningKey.publicKey,
    signedPreKey: stored.signedPreKey.publicKey,
    signedPreKeySignature: stored.signedPreKeySignature,
    oneTimePreKeys: stored.oneTimePreKeys.map((key) => key.publicKey),
    deviceLabel: stored.deviceLabel,
  };
}

export async function verifySignedPreKey(
  bundle: DeviceKeyBundle
): Promise<boolean> {
  const sodium = await getSodium();
  const signature = decode(sodium, bundle.signedPreKeySignature);
  const signedPreKey = decode(sodium, bundle.signedPreKey);
  const signingKey = decode(sodium, bundle.identitySigningKey);

  return sodium.crypto_sign_verify_detached(signature, signedPreKey, signingKey);
}

interface InitialSecrets {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
}

const deriveInitialSecrets = async (
  sharedSecret: Uint8Array
): Promise<InitialSecrets> => {
  const material = await hkdf(sharedSecret, 'X3DH-INITIAL', 96);

  return {
    rootKey: material.slice(0, 32),
    sendingChainKey: material.slice(32, 64),
    receivingChainKey: material.slice(64, 96),
  };
};

export interface RemoteOneTimePreKey {
  id?: string;
  publicKey: string;
}

export interface InitiatorHandshakeResult {
  ratchetState: RatchetState;
  ephemeralKeyPair: KeyPair;
  usedOneTimePreKey?: RemoteOneTimePreKey;
}

export interface InitiatorHandshakeParams {
  localKeys: StoredDeviceKeys;
  remoteBundle: DeviceKeyBundle;
  remoteOneTimePreKey?: RemoteOneTimePreKey;
}

export async function performX3DHInitiation({
  localKeys,
  remoteBundle,
  remoteOneTimePreKey,
}: InitiatorHandshakeParams): Promise<InitiatorHandshakeResult> {
  const sodium = await getSodium();

  if (!(await verifySignedPreKey(remoteBundle))) {
    throw new Error('Remote signed prekey signature verification failed');
  }

  const identityPrivate = decode(sodium, localKeys.identityKey.privateKey);
  const remoteSignedPreKey = decode(sodium, remoteBundle.signedPreKey);
  const remoteIdentityKey = decode(sodium, remoteBundle.identityKey);

  const ephemeralPair = sodium.crypto_kx_keypair();
  const ephemeralKeyPair = toKeyPair(sodium, ephemeralPair);
  const ephemeralPrivate = ephemeralPair.privateKey;
  const contributions: Uint8Array[] = [
    sodium.crypto_scalarmult(identityPrivate, remoteSignedPreKey),
    sodium.crypto_scalarmult(ephemeralPrivate, remoteIdentityKey),
    sodium.crypto_scalarmult(ephemeralPrivate, remoteSignedPreKey),
  ];

  if (remoteOneTimePreKey?.publicKey) {
    const remoteOneTime = decode(sodium, remoteOneTimePreKey.publicKey);
    contributions.push(
      sodium.crypto_scalarmult(ephemeralPrivate, remoteOneTime)
    );
  }

  const sharedSecret = concat(contributions);
  const secrets = await deriveInitialSecrets(sharedSecret);

  const ratchetState: RatchetState = {
    rootKey: encode(sodium, secrets.rootKey),
    sendingChainKey: encode(sodium, secrets.sendingChainKey),
    receivingChainKey: encode(sodium, secrets.receivingChainKey),
    sendingMessageNumber: 0,
    receivingMessageNumber: 0,
    previousSendingMessageNumber: 0,
    localRatchetKey: ephemeralKeyPair,
    remoteRatchetKey: remoteBundle.signedPreKey,
  };

  return {
    ratchetState,
    ephemeralKeyPair,
    usedOneTimePreKey: remoteOneTimePreKey,
  };
}

export interface ResponderHandshakeParams {
  localKeys: StoredDeviceKeys;
  initiatorIdentityKey: string;
  initiatorEphemeralKey: string;
  usedOneTimePreKey?: string;
}

export interface ResponderHandshakeResult {
  ratchetState: RatchetState;
  consumedOneTimePreKey?: KeyPair;
}

export async function completeX3DHResponse({
  localKeys,
  initiatorIdentityKey,
  initiatorEphemeralKey,
  usedOneTimePreKey,
}: ResponderHandshakeParams): Promise<ResponderHandshakeResult> {
  const sodium = await getSodium();
  const signedPreKeyPrivate = decode(sodium, localKeys.signedPreKey.privateKey);
  const identityPrivate = decode(sodium, localKeys.identityKey.privateKey);
  const initiatorIdentity = decode(sodium, initiatorIdentityKey);
  const initiatorEphemeral = decode(sodium, initiatorEphemeralKey);

  const contributions: Uint8Array[] = [
    sodium.crypto_scalarmult(signedPreKeyPrivate, initiatorIdentity),
    sodium.crypto_scalarmult(identityPrivate, initiatorEphemeral),
    sodium.crypto_scalarmult(signedPreKeyPrivate, initiatorEphemeral),
  ];

  let consumedOneTimePreKey: KeyPair | undefined;

  if (usedOneTimePreKey) {
    consumedOneTimePreKey = localKeys.oneTimePreKeys.find(
      (prekey) => prekey.publicKey === usedOneTimePreKey
    );

    if (consumedOneTimePreKey) {
      const privateKey = decode(sodium, consumedOneTimePreKey.privateKey);
      contributions.push(
        sodium.crypto_scalarmult(privateKey, initiatorEphemeral)
      );
    }
  }

  const sharedSecret = concat(contributions);
  const secrets = await deriveInitialSecrets(sharedSecret);

  const ratchetState: RatchetState = {
    rootKey: encode(sodium, secrets.rootKey),
    // Receiver expects to swap sending/receiving chain roles from initiator.
    sendingChainKey: encode(sodium, secrets.receivingChainKey),
    receivingChainKey: encode(sodium, secrets.sendingChainKey),
    sendingMessageNumber: 0,
    receivingMessageNumber: 0,
    previousSendingMessageNumber: 0,
    localRatchetKey: localKeys.signedPreKey,
    remoteRatchetKey: initiatorEphemeralKey,
  };

  return {
    ratchetState,
    consumedOneTimePreKey,
  };
}
