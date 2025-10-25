import sodiumModule, { ready } from 'libsodium-wrappers-sumo';

let sodiumPromise: Promise<typeof sodiumModule> | null = null;

export async function getSodium(): Promise<typeof sodiumModule> {
  if (!sodiumPromise) {
    sodiumPromise = ready.then(() => sodiumModule);
  }
  return sodiumPromise;
}

export async function randomBytes(length: number): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(length);
}

export async function toBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function fromBase64(encoded: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(encoded, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export const UTF8 = new TextEncoder();
export const UTF8_DECODER = new TextDecoder();
