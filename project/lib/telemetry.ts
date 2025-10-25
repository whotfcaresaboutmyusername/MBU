import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';

type TelemetryEvent =
  | 'message_encrypted'
  | 'message_decrypt_success'
  | 'message_decrypt_destroyed'
  | 'message_send_error'
  | 'ratchet_reset'
  | 'key_rotation'
  | (string & {});

interface TrackEventOptions {
  event: TelemetryEvent;
  conversationId?: string;
  actorId?: string;
  severity?: 'info' | 'warning' | 'critical';
  meta?: Record<string, unknown>;
}

const HASH_NAMESPACE = 'sihbolt';

const hashIdentifier = async (value?: string | null): Promise<string | null> => {
  if (!value) {
    return null;
  }

  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${HASH_NAMESPACE}:${value}`
    );
    return digest;
  } catch (error) {
    console.warn('[telemetry] Failed to hash identifier', error);
    return null;
  }
};

export const trackTelemetryEvent = async ({
  event,
  conversationId,
  actorId,
  severity = 'info',
  meta = {},
}: TrackEventOptions): Promise<void> => {
  try {
    const hashedConversationId = await hashIdentifier(conversationId);
    const hashedActorId = await hashIdentifier(actorId);

    const payload = {
      event,
      severity,
      conversation: hashedConversationId,
      actor: hashedActorId,
      timestamp: new Date().toISOString(),
      meta,
    };

    const { error } = await supabase.functions.invoke('telemetry-ingest', {
      body: payload,
    });

    if (error) {
      console.warn('[telemetry] invocation error', error);
    }
  } catch (error) {
    console.warn('[telemetry] Failed to emit event', error);
  }
};
