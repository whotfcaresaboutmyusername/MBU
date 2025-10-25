// Polyfill for crypto functionality needed by libsodium in React Native
import 'react-native-url-polyfill/auto';
import * as ExpoCrypto from 'expo-crypto';

console.log('[crypto-polyfill] Initializing crypto polyfills for React Native...');

// Ensure crypto.getRandomValues is available globally for @stablelib
if (typeof global.crypto === 'undefined') {
  global.crypto = {} as any;
}

// Use expo-crypto's getRandomValues which works reliably on React Native
if (typeof global.crypto.getRandomValues === 'undefined') {
  global.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (!array) {
      throw new TypeError('Argument cannot be null');
    }
    
    // Use expo-crypto to fill the array with random bytes
    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    view.set(bytes);
    
    return array;
  };
  console.log('[crypto-polyfill] crypto.getRandomValues polyfilled using expo-crypto');
}

// Polyfill for TextEncoder/TextDecoder if needed
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Set up global for potential issues with 'window' references
if (typeof global.window === 'undefined') {
  // @ts-ignore
  global.window = global;
}

// Ensure document exists (required by some libsodium initialization code)
if (typeof global.document === 'undefined') {
  // @ts-ignore
  global.document = {
    createElement: () => ({}),
    getElementsByTagName: () => [],
    querySelector: () => null,
  };
}

// Mock WebAssembly if not available (will force libsodium to use asm.js)
if (typeof global.WebAssembly === 'undefined') {
  console.log('[crypto-polyfill] WebAssembly not available, libsodium will use asm.js fallback');
  // Don't define WebAssembly - let libsodium detect it's missing and use asm.js
}

console.log('[crypto-polyfill] Crypto polyfills initialized');

export {};

