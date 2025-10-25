import {
  ensureDeviceKeys,
  fetchRemoteDeviceBundle,
  markPreKeyConsumed,
} from './crypto/deviceKeys';
import { DoubleRatchet } from './crypto/doubleRatchet';
import {
  loadDeviceKeys,
  loadSession,
  saveDeviceKeys,
  saveSession,
} from './crypto/sessionStore';
import {
  completeX3DHResponse,
  performX3DHInitiation,
} from './crypto/x3dh';
import type { RatchetHeader, SessionState } from './crypto/types';

interface SessionContext {
  conversationId: string;
  localUserId: string;
  remoteUserId: string;
}

export interface EncryptionOptions extends SessionContext {
  associatedData?: string;
}

export interface DecryptionOptions extends SessionContext {
  senderIsLocal: boolean;
}

interface SignalHandshakeMetadata {
  oneTimePreKeyId?: string;
  oneTimePreKey?: string;
}

export interface SignalEnvelope {
  version: number;
  header: RatchetHeader;
  ciphertext: string;
  associatedData?: string;
  handshake?: SignalHandshakeMetadata;
}

const ENVELOPE_VERSION = 1;
const MESSAGE_KEY_CACHE_LIMIT = 128;

const serialize = (value: SignalEnvelope): string =>
  JSON.stringify(value);

export const parseEnvelope = (payload: string): SignalEnvelope | null => {
  try {
    const parsed = JSON.parse(payload) as SignalEnvelope;
    if (!parsed || typeof parsed !== 'object' || !parsed.header) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const buildCacheKey = (header: RatchetHeader): string =>
  `${header.ratchetKey}:${header.messageNumber}`;

const pruneCache = (
  cache: Record<string, string>,
  limit = MESSAGE_KEY_CACHE_LIMIT
): Record<string, string> => {
  const entries = Object.entries(cache);
  if (entries.length <= limit) {
    return cache;
  }
  const slice = entries.slice(entries.length - limit);
  return Object.fromEntries(slice);
};

const createSession = (
  context: SessionContext,
  ratchetState: SessionState['ratchetState'],
  handshakeMeta?: SignalHandshakeMetadata
): SessionState => ({
  conversationId: context.conversationId,
  partnerId: context.remoteUserId,
  ratchetState,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  awaitingPreKey: handshakeMeta?.oneTimePreKeyId ?? null,
  messageKeyCache: {},
});

export async function encryptMessage(
  plaintext: string,
  options: EncryptionOptions
): Promise<string> {
  if (!plaintext) {
    return '';
  }

  const { conversationId, localUserId, remoteUserId, associatedData } = options;
  const localKeys = await ensureDeviceKeys(localUserId);
  let session = await loadSession(conversationId);
  let handshakeMeta: SignalHandshakeMetadata | undefined;
  let isNewSession = false;

  if (!session || session.partnerId !== remoteUserId) {
    const remote = await fetchRemoteDeviceBundle(remoteUserId);
    if (!remote) {
      throw new Error('Remote contact is missing Signal key material');
    }

    const handshake = await performX3DHInitiation({
      localKeys,
      remoteBundle: remote.bundle,
      remoteOneTimePreKey: remote.oneTimePreKey
        ? {
            id: remote.oneTimePreKeyId,
            publicKey: remote.oneTimePreKey,
          }
        : undefined,
    });

    if (remote.oneTimePreKeyId) {
      await markPreKeyConsumed(remote.oneTimePreKeyId);
    }

    session = createSession(
      { conversationId, localUserId, remoteUserId },
      handshake.ratchetState,
      remote.oneTimePreKey
        ? {
            oneTimePreKeyId: remote.oneTimePreKeyId,
            oneTimePreKey: remote.oneTimePreKey,
          }
        : undefined
    );

    handshakeMeta = remote.oneTimePreKey
      ? {
          oneTimePreKeyId: remote.oneTimePreKeyId,
          oneTimePreKey: remote.oneTimePreKey,
        }
      : undefined;

    isNewSession = true;
  }

  const ratchet = await DoubleRatchet.fromState(session.ratchetState);
  const { payload, messageKey } = await ratchet.encrypt(
    plaintext,
    associatedData
  );

  session.ratchetState = await ratchet.getState();
  session.updatedAt = Date.now();

  const cacheKey = buildCacheKey(payload.header);
  const cache = session.messageKeyCache ?? {};
  cache[cacheKey] = messageKey;
  session.messageKeyCache = pruneCache(cache);
  session.awaitingPreKey = null;

  await saveSession(session);

  const envelope: SignalEnvelope = {
    version: ENVELOPE_VERSION,
    header: payload.header,
    ciphertext: payload.ciphertext,
    associatedData: payload.associatedData,
    handshake: isNewSession ? handshakeMeta : undefined,
  };

  return serialize(envelope);
}

export async function decryptMessage(
  ciphertext: string,
  options: DecryptionOptions
): Promise<string> {
  if (!ciphertext) {
    return '';
  }

  const envelope = parseEnvelope(ciphertext);
  if (!envelope || envelope.version !== ENVELOPE_VERSION) {
    // Legacy or plaintext message fallback.
    return ciphertext;
  }

  const { conversationId, localUserId, remoteUserId, senderIsLocal } = options;
  let session = await loadSession(conversationId);
  const cache = session?.messageKeyCache ?? {};

  if (!session || session.partnerId !== remoteUserId) {
    if (senderIsLocal) {
      return '[encrypted]';
    }

    const localKeys = await ensureDeviceKeys(localUserId);
    const remote = await fetchRemoteDeviceBundle(remoteUserId);

    if (!remote) {
      throw new Error('Unable to locate Signal keys for sender');
    }

    const handshake = await completeX3DHResponse({
      localKeys,
      initiatorIdentityKey: remote.bundle.identityKey,
      initiatorEphemeralKey: envelope.header.ratchetKey,
      usedOneTimePreKey: envelope.handshake?.oneTimePreKey,
    });

    session = createSession(
      { conversationId, localUserId, remoteUserId },
      handshake.ratchetState,
      envelope.handshake
    );

    if (handshake.consumedOneTimePreKey) {
      const storedKeys = await loadDeviceKeys();

      if (storedKeys) {
        storedKeys.oneTimePreKeys = storedKeys.oneTimePreKeys.filter(
          (prekey) =>
            prekey.publicKey !== handshake.consumedOneTimePreKey?.publicKey
        );
        await saveDeviceKeys(storedKeys);
      }
    }

    if (envelope.handshake?.oneTimePreKeyId) {
      await markPreKeyConsumed(envelope.handshake.oneTimePreKeyId);
    }
  }

  if (!session) {
    throw new Error('Session initialization failed');
  }

  const ratchet = await DoubleRatchet.fromState(session.ratchetState);
  const cacheKey = buildCacheKey(envelope.header);
  let plaintext: string | null = null;

  if (senderIsLocal) {
    const cachedMessageKey = cache[cacheKey];

    if (!cachedMessageKey) {
      return '[encrypted]';
    }

    plaintext = await ratchet.decryptWithKnownKey(
      {
        header: envelope.header,
        ciphertext: envelope.ciphertext,
        associatedData: envelope.associatedData,
      },
      cachedMessageKey
    );
  } else {
    const result = await ratchet.decryptIncoming({
      header: envelope.header,
      ciphertext: envelope.ciphertext,
      associatedData: envelope.associatedData,
    });

    plaintext = result.plaintext;
    cache[cacheKey] = result.messageKey;
    session.messageKeyCache = pruneCache(cache);
  }

  session.ratchetState = await ratchet.getState();
  session.updatedAt = Date.now();

  if (!senderIsLocal) {
    await saveSession(session);
  } else {
    await saveSession({
      ...session,
      messageKeyCache: pruneCache(cache),
    });
  }

  return plaintext;
}
