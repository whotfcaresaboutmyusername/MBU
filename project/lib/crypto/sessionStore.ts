import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionState, StoredDeviceKeys } from './types';

const SESSION_PREFIX = 'signal_session_';
const DEVICE_KEY = 'signal_device_keys';

const serialize = (value: unknown): string =>
  JSON.stringify(value, null, 2);

// Platform-aware storage wrapper
// SecureStore doesn't work on web, so we use localStorage as fallback
console.log(`[storage] Using ${Platform.OS === 'web' ? 'localStorage' : 'SecureStore'} for platform: ${Platform.OS}`);

const storage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('[storage] localStorage.getItem failed:', error);
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('[storage] localStorage.setItem failed:', error);
        throw error;
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('[storage] localStorage.removeItem failed:', error);
      }
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export async function saveSession(state: SessionState): Promise<void> {
  await storage.setItemAsync(
    `${SESSION_PREFIX}${state.conversationId}`,
    serialize(state)
  );
}

export async function loadSession(
  conversationId: string
): Promise<SessionState | null> {
  const raw = await storage.getItemAsync(
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
  await storage.setItemAsync(DEVICE_KEY, serialize(keys));
}

export async function loadDeviceKeys(): Promise<StoredDeviceKeys | null> {
  const raw = await storage.getItemAsync(DEVICE_KEY);

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
  await storage.deleteItemAsync(DEVICE_KEY);
}

export async function deleteSession(conversationId: string): Promise<void> {
  await storage.deleteItemAsync(`${SESSION_PREFIX}${conversationId}`);
}
