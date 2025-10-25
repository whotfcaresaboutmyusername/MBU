import { supabase } from '@/lib/supabase';
import type {
  DeviceKeyBundle,
  StoredDeviceKeys,
} from './types';
import {
  generateDeviceKeys,
  deviceBundleFromStoredKeys,
} from './x3dh';
import {
  clearDeviceKeys,
  loadDeviceKeys,
  saveDeviceKeys,
} from './sessionStore';

interface RemoteDeviceRow {
  id: string;
  device_label: string;
  identity_key_public: string;
  identity_signing_public: string;
  signed_prekey_public: string;
  signed_prekey_signature: string;
  device_prekeys: Array<{
    id: string;
    prekey_id: number;
    public_key: string;
    consumed: boolean;
  }>;
}

export interface RemoteDeviceBundle {
  bundle: DeviceKeyBundle;
  oneTimePreKeyId?: string;
  oneTimePreKey?: string;
  deviceId: string;
}

const mapRemoteBundle = (row: RemoteDeviceRow): RemoteDeviceBundle => {
  const unconsumed = row.device_prekeys?.find((prekey) => !prekey.consumed);

  return {
    bundle: {
      identityKey: row.identity_key_public,
      identitySigningKey: row.identity_signing_public,
      signedPreKey: row.signed_prekey_public,
      signedPreKeySignature: row.signed_prekey_signature,
      oneTimePreKeys: row.device_prekeys
        ?.filter((prekey) => !prekey.consumed)
        .map((prekey) => prekey.public_key) ?? [],
      deviceLabel: row.device_label,
    },
    oneTimePreKeyId: unconsumed?.id,
    oneTimePreKey: unconsumed?.public_key,
    deviceId: row.id,
  };
};

interface ProfileHint {
  contact?: string;
  displayName?: string;
}

const deriveFallbackContact = async (
  userId: string,
  hint?: ProfileHint
): Promise<{ contact: string; displayName: string }> => {
  let contact =
    hint?.contact?.trim() && hint.contact.length > 0
      ? hint.contact.trim()
      : '';
  let displayName =
    hint?.displayName?.trim() && hint.displayName.length > 0
      ? hint.displayName.trim()
      : '';

  if (!contact) {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id === userId) {
      contact =
        data.user.email ||
        data.user.phone ||
        `user-${userId.slice(0, 8)}`;
    } else {
      contact = `user-${userId.slice(0, 8)}`;
    }
  }

  if (!displayName) {
    displayName = contact.includes('@')
      ? contact.split('@')[0]
      : contact;
  }

  return { contact, displayName };
};

const ensureProfileExists = async (
  userId: string,
  hint?: ProfileHint
) => {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { contact, displayName } = await deriveFallbackContact(
    userId,
    hint
  );

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      phone_number: contact,
      display_name: displayName,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }
};

export async function ensureDeviceKeys(
  userId: string,
  deviceLabel = 'primary',
  hint?: ProfileHint
): Promise<StoredDeviceKeys> {
  await ensureProfileExists(userId, hint);

  let keys = await loadDeviceKeys();

  if (!keys || keys.deviceLabel !== deviceLabel) {
    const generated = await generateDeviceKeys(deviceLabel);
    keys = generated;
    await saveDeviceKeys(keys);
  }

  await publishDeviceKeys(userId, keys);
  return keys;
}

export async function publishDeviceKeys(
  userId: string,
  keys: StoredDeviceKeys
): Promise<void> {
  const publicBundle = await deviceBundleFromStoredKeys(keys);
  const { data: deviceRow, error } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: userId,
        device_label: publicBundle.deviceLabel,
        identity_key_public: publicBundle.identityKey,
        identity_signing_public: publicBundle.identitySigningKey,
        signed_prekey_public: publicBundle.signedPreKey,
        signed_prekey_signature: publicBundle.signedPreKeySignature,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,device_label',
      }
    )
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  if (!deviceRow) {
    throw new Error('Unable to determine device identifier after upsert');
  }

  const prekeyPayload = keys.oneTimePreKeys.map((prekey, index) => ({
    device_id: deviceRow.id,
    prekey_id: index,
    public_key: prekey.publicKey,
    consumed: false,
  }));

  const { error: prekeyError } = await supabase
    .from('device_prekeys')
    .upsert(prekeyPayload, { onConflict: 'device_id,prekey_id' });

  if (prekeyError) {
    throw prekeyError;
  }
}

export async function fetchRemoteDeviceBundle(
  userId: string
): Promise<RemoteDeviceBundle | null> {
  const { data, error } = await supabase
    .from('user_devices')
    .select(
      `
      id,
      device_label,
      identity_key_public,
      identity_signing_public,
      signed_prekey_public,
      signed_prekey_signature,
      device_prekeys (
        id,
        prekey_id,
        public_key,
        consumed
      )
    `
    )
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRemoteBundle(data as RemoteDeviceRow);
}

export async function markPreKeyConsumed(
  devicePreKeyId: string
): Promise<void> {
  const { error } = await supabase
    .from('device_prekeys')
    .update({ consumed: true })
    .eq('id', devicePreKeyId);

  if (error) {
    throw error;
  }
}

export async function resetDeviceKeys(): Promise<void> {
  await clearDeviceKeys();
}
