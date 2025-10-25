import { getSodium, UTF8 } from './sodium';

const HMAC_KEY_BYTES = 32;

const toUint8 = (value: Uint8Array | string): Uint8Array => {
  if (typeof value === 'string') {
    return UTF8.encode(value);
  }
  return value;
};

const concat = (first: Uint8Array, second: Uint8Array): Uint8Array => {
  const result = new Uint8Array(first.length + second.length);
  result.set(first, 0);
  result.set(second, first.length);
  return result;
};

export async function hkdf(
  inputKeyMaterial: Uint8Array,
  info: Uint8Array | string,
  length = 32,
  salt?: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const saltKey: Uint8Array =
    salt && salt.length
      ? salt
      : new Uint8Array(HMAC_KEY_BYTES /* zeroed salt */);
  const prk = sodium.crypto_auth_hmacsha256(
    inputKeyMaterial,
    saltKey
  ) as Uint8Array;
  const infoBytes = toUint8(info);
  const hashLen = sodium.crypto_auth_hmacsha256_BYTES;
  const blocks = Math.ceil(length / hashLen);
  let previous: Uint8Array = new Uint8Array(0);
  let output: Uint8Array = new Uint8Array(0);

  for (let i = 1; i <= blocks; i++) {
    const message = new Uint8Array(previous.length + infoBytes.length + 1);
    message.set(previous, 0);
    message.set(infoBytes, previous.length);
    message[message.length - 1] = i;

    previous = sodium.crypto_auth_hmacsha256(message, prk) as Uint8Array;
    output = concat(output, previous);
  }

  return output.slice(0, length);
}
