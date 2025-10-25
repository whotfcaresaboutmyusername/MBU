import {
  ensureDeviceKeys,
  fetchRemoteDeviceBundle,
  markPreKeyConsumed,
} from './crypto/deviceKeys';
import { DoubleRatchet } from './crypto/doubleRatchet';
import {
  deleteSession,
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
import { trackTelemetryEvent } from './telemetry';

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
  senderIdentityKey?: string;
  senderDeviceLabel?: string;
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

export const DESTROYED_MESSAGE_PLACEHOLDER = '[destroyed]';

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
  console.log('[encryptMessage] Starting encryption...');
  
  if (!plaintext) {
    console.log('[encryptMessage] Empty plaintext, returning empty string');
    return '';
  }

  const { conversationId, localUserId, remoteUserId, associatedData } = options;
  console.log('[encryptMessage] Options:', { conversationId, localUserId, remoteUserId });
  
  console.log('[encryptMessage] Ensuring device keys...');
  const localKeys = await ensureDeviceKeys(localUserId);
  console.log('[encryptMessage] Device keys loaded');
  
  console.log('[encryptMessage] Loading session...');
  let session = await loadSession(conversationId);
  let handshakeMeta: SignalHandshakeMetadata | undefined;
  let isNewSession = false;
  
  console.log('[encryptMessage] Session loaded:', session ? 'exists' : 'null');

  if (!session || session.partnerId !== remoteUserId) {
    console.log('[encryptMessage] Creating new session, fetching remote bundle...');
    try {
      const remote = await fetchRemoteDeviceBundle(remoteUserId);
      if (!remote) {
        throw new Error('Remote contact is missing Signal key material');
      }
      console.log('[encryptMessage] Remote bundle fetched successfully');

      console.log('[encryptMessage] Performing X3DH initiation...');
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
      console.log('[encryptMessage] X3DH handshake completed');

      if (remote.oneTimePreKeyId) {
        await markPreKeyConsumed(remote.oneTimePreKeyId);
      }

      const handshakeSeed: SignalHandshakeMetadata = {
        senderIdentityKey: localKeys.identityKey.publicKey,
        senderDeviceLabel: localKeys.deviceLabel,
      };

      if (remote.oneTimePreKey && remote.oneTimePreKeyId) {
        handshakeSeed.oneTimePreKeyId = remote.oneTimePreKeyId;
        handshakeSeed.oneTimePreKey = remote.oneTimePreKey;
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

      handshakeMeta = handshakeSeed;

      isNewSession = true;
      console.log('[encryptMessage] New session created');
    } catch (error) {
      console.error('[encryptMessage] Failed to create session:', error);
      throw error;
    }
  }

  try {
    console.log('[encryptMessage] Creating double ratchet from session...');
    const ratchet = await DoubleRatchet.fromState(session.ratchetState);
    
    console.log('[encryptMessage] Encrypting with double ratchet...');
    const { payload, messageKey } = await ratchet.encrypt(
      plaintext,
      associatedData
    );
    console.log('[encryptMessage] Double ratchet encryption complete');

    session.ratchetState = await ratchet.getState();
    session.updatedAt = Date.now();

    const cacheKey = buildCacheKey(payload.header);
    const cache = session.messageKeyCache ?? {};
    cache[cacheKey] = messageKey;
    session.messageKeyCache = pruneCache(cache);
    session.awaitingPreKey = null;

    console.log('[encryptMessage] Saving session...');
    await saveSession(session);
    console.log('[encryptMessage] Session saved');

    const envelope: SignalEnvelope = {
      version: ENVELOPE_VERSION,
      header: payload.header,
      ciphertext: payload.ciphertext,
      associatedData: payload.associatedData,
      handshake: isNewSession ? handshakeMeta : undefined,
    };

    const serialized = serialize(envelope);
    console.log('[encryptMessage] Encryption completed successfully');
    void trackTelemetryEvent({
      event: 'message_encrypted',
      conversationId,
      actorId: localUserId,
      meta: {
        hasHandshake: !!envelope.handshake,
        payloadLength: serialized.length,
      },
    });
    return serialized;
  } catch (error) {
    console.error('[encryptMessage] Encryption failed:', error);
    void trackTelemetryEvent({
      event: 'message_send_error',
      conversationId,
      actorId: localUserId,
      severity: 'warning',
      meta: { reason: error instanceof Error ? error.message : 'unknown' },
    });
    throw error;
  }
}

export async function decryptMessage(
  ciphertext: string,
  options: DecryptionOptions
): Promise<string> {
  console.log('[decryptMessage] Starting decryption...', { 
    conversationId: options.conversationId,
    senderIsLocal: options.senderIsLocal 
  });
  
  if (!ciphertext) {
    console.log('[decryptMessage] Empty ciphertext');
    return '';
  }

  const envelope = parseEnvelope(ciphertext);
  if (!envelope || envelope.version !== ENVELOPE_VERSION) {
    console.log('[decryptMessage] Invalid envelope or version mismatch, returning as-is');
    // Legacy or plaintext message fallback.
    return ciphertext;
  }

  const { conversationId, localUserId, remoteUserId, senderIsLocal } = options;
  let session = await loadSession(conversationId);
  const cache = session?.messageKeyCache ?? {};
  
  console.log('[decryptMessage] Session loaded:', {
    sessionExists: !!session,
    partnerId: session?.partnerId,
    expectedRemoteUser: remoteUserId,
    remoteUserMatches: session?.partnerId === remoteUserId,
    senderIsLocal,
    localUserId,
    hasHandshake: !!envelope.handshake
  });

  if (!session || session.partnerId !== remoteUserId) {
    console.log('[decryptMessage] Session missing or partner mismatch, initializing new session');
    
    if (senderIsLocal) {
      console.log('[decryptMessage] Sender is local but no session found - returning encrypted');
      return '[encrypted]';
    }

    console.log('[decryptMessage] Completing X3DH handshake as responder');
    const localKeys = await ensureDeviceKeys(localUserId);

    let remote: Awaited<ReturnType<typeof fetchRemoteDeviceBundle>> = null;
    try {
      remote = await fetchRemoteDeviceBundle(remoteUserId);
    } catch (bundleError) {
      console.warn('[decryptMessage] Failed to fetch remote device bundle:', bundleError);
    }

    const identityFromEnvelope = envelope.handshake?.senderIdentityKey;
    const identityFromBundle = remote?.bundle.identityKey;
    const initiatorIdentityKey = identityFromEnvelope ?? identityFromBundle;

    if (!initiatorIdentityKey) {
      console.error('[decryptMessage] Missing initiator identity key for handshake');
      throw new Error('Unable to determine sender identity key for handshake');
    }

    if (
      identityFromEnvelope &&
      identityFromBundle &&
      identityFromEnvelope !== identityFromBundle
    ) {
      console.warn(
        '[decryptMessage] Sender identity mismatch between envelope and bundle; preferring envelope value'
      );
    }

    console.log('[decryptMessage] Handshake identity resolved:', {
      fromEnvelope: !!identityFromEnvelope,
      fromBundle: !!identityFromBundle,
    });

    const handshake = await completeX3DHResponse({
      localKeys,
      initiatorIdentityKey,
      initiatorEphemeralKey: envelope.header.ratchetKey,
      usedOneTimePreKey: envelope.handshake?.oneTimePreKey,
    });

    console.log('[decryptMessage] X3DH handshake completed, creating session');
    session = createSession(
      { conversationId, localUserId, remoteUserId },
      handshake.ratchetState,
      envelope.handshake
    );

    if (handshake.consumedOneTimePreKey) {
      const storedKeys = await loadDeviceKeys();

      if (storedKeys) {
        const publicKey = handshake.consumedOneTimePreKey.publicKey;
        const wasActive = storedKeys.oneTimePreKeys.some(
          (prekey) => prekey.publicKey === publicKey
        );

        if (wasActive) {
          storedKeys.oneTimePreKeys = storedKeys.oneTimePreKeys.filter(
            (prekey) => prekey.publicKey !== publicKey
          );
          const consumedList = storedKeys.consumedOneTimePreKeys ?? [];
          const alreadyTracked = consumedList.some(
            (prekey) => prekey.publicKey === publicKey
          );

          if (!alreadyTracked) {
            storedKeys.consumedOneTimePreKeys = [
              ...consumedList,
              handshake.consumedOneTimePreKey,
            ];
          }

          await saveDeviceKeys(storedKeys);
        }
      }
    }

    if (envelope.handshake?.oneTimePreKeyId) {
      await markPreKeyConsumed(envelope.handshake.oneTimePreKeyId);
    }
  }

  if (!session) {
    console.error('[decryptMessage] Session initialization failed');
    throw new Error('Session initialization failed');
  }

  try {
    const ratchet = await DoubleRatchet.fromState(session.ratchetState);
    const cacheKey = buildCacheKey(envelope.header);
    let plaintext: string | null = null;

    if (senderIsLocal) {
      console.log('[decryptMessage] Decrypting own message with cached key');
      const cachedMessageKey = cache[cacheKey];

      if (!cachedMessageKey) {
        console.log('[decryptMessage] No cached key found for own message');
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
      console.log('[decryptMessage] Decrypting incoming message with ratchet');
      const cachedMessageKey = cache[cacheKey];

      if (cachedMessageKey) {
        console.log('[decryptMessage] Using cached key for incoming message');
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

        if (Array.isArray(result.skippedMessageKeys)) {
          for (const skipped of result.skippedMessageKeys) {
            const skippedCacheKey = `${skipped.ratchetKey}:${skipped.messageNumber}`;
            if (!cache[skippedCacheKey]) {
              cache[skippedCacheKey] = skipped.key;
            }
          }
        }
      }

      session.messageKeyCache = pruneCache(cache);
    }

    session.ratchetState = await ratchet.getState();
    session.updatedAt = Date.now();

    if (!senderIsLocal) {
      await saveSession(session);
      console.log('[decryptMessage] Session saved after decrypting incoming message');
    } else {
      await saveSession({
        ...session,
        messageKeyCache: pruneCache(cache),
      });
      console.log('[decryptMessage] Session saved after decrypting own message');
    }

    console.log('[decryptMessage] Decryption successful');
    void trackTelemetryEvent({
      event: 'message_decrypt_success',
      conversationId,
      actorId: localUserId,
      meta: {
        senderIsLocal,
        cipherLength: envelope.ciphertext.length,
      },
    });
    return plaintext;
  } catch (error) {
    console.warn('[decryptMessage] Unable to decrypt payload, marking as destroyed:', {
      conversationId,
      senderIsLocal,
      error: error instanceof Error ? error.message : error,
    });

    if (!senderIsLocal) {
      await deleteSession(conversationId);
      void trackTelemetryEvent({
        event: 'ratchet_reset',
        conversationId,
        actorId: localUserId,
        severity: 'warning',
        meta: { reason: 'decrypt_failure' },
      });
    }

    void trackTelemetryEvent({
      event: 'message_decrypt_destroyed',
      conversationId,
      actorId: localUserId,
      severity: 'warning',
      meta: { reason: error instanceof Error ? error.message : 'Unknown error' },
    });

    return DESTROYED_MESSAGE_PLACEHOLDER;
  }
}

/**
 * Clears the encrypted session for a conversation.
 * Use this to reset corrupted sessions.
 */
export async function clearConversationSession(conversationId: string): Promise<void> {
  console.log('[clearConversationSession] Clearing session:', conversationId);
  await deleteSession(conversationId);
}
