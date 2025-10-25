import * as SecureStore from 'expo-secure-store';
import type { SessionState, StoredDeviceKeys } from './types';

const SESSION_PREFIX = 'signal_session_';
const DEVICE_KEY = 'signal_device_keys';

const serialize = (value: unknown): string =>
  JSON.stringify(value, null, 2);

export async function saveSession(state: SessionState): Promise<void> {
  await SecureStore.setItemAsync(
    `${SESSION_PREFIX}${state.conversationId}`,
    serialize(state)
  );
}

export async function loadSession(
  conversationId: string
): Promise<SessionState | null> {
  const raw = await SecureStore.getItemAsync(
    `${SESSION_PREFIX}${conversationId}`
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch (error) {
    console.warn('[signal] Failed to parse stored session', error);
    return null;
  }
}

export async function saveDeviceKeys(keys: StoredDeviceKeys): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_KEY, serialize(keys));
}

export async function loadDeviceKeys(): Promise<StoredDeviceKeys | null> {
  const raw = await SecureStore.getItemAsync(DEVICE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredDeviceKeys;
  } catch (error) {
    console.warn('[signal] Failed to parse device keys', error);
    return null;
  }
}

export async function clearDeviceKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_KEY);
}

export async function deleteSession(conversationId: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${SESSION_PREFIX}${conversationId}`);
}
