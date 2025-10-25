// React Native compatible sodium implementation using @stablelib
import '../crypto-polyfill';
import * as ExpoCrypto from 'expo-crypto';
import { encode as base64Encode, decode as base64Decode } from '@stablelib/base64';
import * as ed25519 from '@stablelib/ed25519';
import * as x25519 from '@stablelib/x25519';
import { HKDF } from '@stablelib/hkdf';
import { SHA256 } from '@stablelib/sha256';
import { XChaCha20Poly1305 } from '@stablelib/xchacha20poly1305';

console.log('[sodium-stable] Using @stablelib for React Native crypto operations');

// Use expo-crypto for random bytes generation (reliable on React Native)
function cryptoRandomBytes(length: number): Uint8Array {
  return ExpoCrypto.getRandomBytes(length);
}

// Create a compatible interface with libsodium
export const base64_variants = {
  ORIGINAL: 1,
  ORIGINAL_NO_PADDING: 3,
  URLSAFE: 5,
  URLSAFE_NO_PADDING: 7,
};

// Crypto constants
export const crypto_auth_hmacsha256_BYTES = 32;
export const crypto_sign_BYTES = 64;
export const crypto_sign_PUBLICKEYBYTES = 32;
export const crypto_sign_SECRETKEYBYTES = 64;
export const crypto_box_PUBLICKEYBYTES = 32;
export const crypto_box_SECRETKEYBYTES = 32;
export const crypto_scalarmult_BYTES = 32;
export const crypto_secretbox_KEYBYTES = 32;
export const crypto_secretbox_NONCEBYTES = 24;
export const crypto_aead_xchacha20poly1305_ietf_KEYBYTES = 32;
export const crypto_aead_xchacha20poly1305_ietf_NPUBBYTES = 24;
export const crypto_aead_xchacha20poly1305_ietf_ABYTES = 16;

// Helper to convert between base64 variants (for now, only support URLSAFE_NO_PADDING)
function encodeBase64(data: Uint8Array, variant: number): string {
  const encoded = base64Encode(data);
  if (variant === base64_variants.URLSAFE_NO_PADDING) {
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  return encoded;
}

function decodeBase64(str: string, variant: number): Uint8Array {
  let normalized = str;
  if (variant === base64_variants.URLSAFE_NO_PADDING) {
    normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (normalized.length % 4 !== 0) {
      normalized += '=';
    }
  }
  return base64Decode(normalized);
}

// Libsodium compatible API
export function randombytes_buf(length: number): Uint8Array {
  return cryptoRandomBytes(length);
}

export function to_base64(data: Uint8Array, variant: number = base64_variants.URLSAFE_NO_PADDING): string {
  return encodeBase64(data, variant);
}

export function from_base64(str: string, variant: number = base64_variants.URLSAFE_NO_PADDING): Uint8Array {
  return decodeBase64(str, variant);
}

// Ed25519 signing key operations
export function crypto_sign_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  const seed = cryptoRandomBytes(32);
  const keyPair = ed25519.generateKeyPairFromSeed(seed);
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
  };
}

export function crypto_sign_detached(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(privateKey, message);
}

export function crypto_sign_verify_detached(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): boolean {
  return ed25519.verify(publicKey, message, signature);
}

// Convert Ed25519 keys to Curve25519 keys
export function crypto_sign_ed25519_pk_to_curve25519(ed25519PublicKey: Uint8Array): Uint8Array {
  // Ed25519 to Curve25519 conversion
  // For compatibility, we'll use the first 32 bytes as-is
  // Note: This is a simplified version. Full conversion requires Montgomery curve operations.
  return ed25519.convertPublicKeyToX25519(ed25519PublicKey);
}

export function crypto_sign_ed25519_sk_to_curve25519(ed25519SecretKey: Uint8Array): Uint8Array {
  // Ed25519 to Curve25519 conversion for secret key
  // Extract the first 32 bytes (seed) from ed25519 secret key
  return ed25519.convertSecretKeyToX25519(ed25519SecretKey);
}

// X25519 key exchange operations
export function crypto_kx_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  const privateKey = cryptoRandomBytes(32);
  const publicKey = x25519.scalarMultBase(privateKey);
  return { publicKey, privateKey };
}

export function crypto_scalarmult(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.scalarMult(privateKey, publicKey);
}

// HMAC-SHA256
export function crypto_auth_hmacsha256(message: Uint8Array, key: Uint8Array): Uint8Array {
  // Implement HMAC-SHA256 using the standard HMAC construction
  // HMAC(K,m) = H((K' ⊕ opad) || H((K' ⊕ ipad) || m))
  const blockSize = 64; // SHA-256 block size
  const ipad = 0x36;
  const opad = 0x5c;
  
  // Prepare key
  let keyPrime: Uint8Array;
  if (key.length > blockSize) {
    const hash = new SHA256();
    hash.update(key);
    keyPrime = hash.digest();
  } else {
    keyPrime = key;
  }
  
  // Pad key to block size
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(keyPrime);
  
  // Compute inner hash
  const innerKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    innerKey[i] = paddedKey[i] ^ ipad;
  }
  const innerHash = new SHA256();
  innerHash.update(innerKey);
  innerHash.update(message);
  const innerResult = innerHash.digest();
  
  // Compute outer hash
  const outerKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    outerKey[i] = paddedKey[i] ^ opad;
  }
  const outerHash = new SHA256();
  outerHash.update(outerKey);
  outerHash.update(innerResult);
  
  return outerHash.digest();
}

// XChaCha20-Poly1305 AEAD encryption
export function crypto_aead_xchacha20poly1305_ietf_encrypt(
  message: Uint8Array,
  additionalData: Uint8Array | null,
  _secretNonce: null,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array {
  const cipher = new XChaCha20Poly1305(key);
  return cipher.seal(nonce, message, additionalData || undefined);
}

export function crypto_aead_xchacha20poly1305_ietf_decrypt(
  _secretNonce: null,
  ciphertext: Uint8Array,
  additionalData: Uint8Array | null,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array | null {
  const cipher = new XChaCha20Poly1305(key);
  return cipher.open(nonce, ciphertext, additionalData || undefined);
}

// Create a module-like object for compatibility
const sodiumModule = {
  ready: Promise.resolve(),
  randombytes_buf,
  to_base64,
  from_base64,
  base64_variants,
  crypto_sign_keypair,
  crypto_sign_detached,
  crypto_sign_verify_detached,
  crypto_sign_ed25519_pk_to_curve25519,
  crypto_sign_ed25519_sk_to_curve25519,
  crypto_kx_keypair,
  crypto_scalarmult,
  crypto_auth_hmacsha256,
  crypto_auth_hmacsha256_BYTES,
  crypto_sign_BYTES,
  crypto_sign_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES,
  crypto_box_PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES,
  crypto_scalarmult_BYTES,
  crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES,
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  crypto_aead_xchacha20poly1305_ietf_ABYTES,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
};

export type SodiumModule = typeof sodiumModule;

let sodiumPromise: Promise<SodiumModule> | null = null;

export async function getSodium(): Promise<SodiumModule> {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      console.log('[getSodium] @stablelib crypto initialized successfully');
      return sodiumModule;
    })();
  }
  return sodiumPromise;
}

export async function randomBytes(length: number): Promise<Uint8Array> {
  return cryptoRandomBytes(length);
}

export async function toBase64(bytes: Uint8Array): Promise<string> {
  return encodeBase64(bytes, base64_variants.URLSAFE_NO_PADDING);
}

export async function fromBase64(encoded: string): Promise<Uint8Array> {
  return decodeBase64(encoded, base64_variants.URLSAFE_NO_PADDING);
}

export const UTF8 = new TextEncoder();
export const UTF8_DECODER = new TextDecoder();

export default sodiumModule;

