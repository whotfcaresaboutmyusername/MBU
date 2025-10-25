export interface KeyPair {
  publicKey: string; // base64url
  privateKey: string; // base64url
}

export interface SigningKeyPair {
  publicKey: string; // base64url
  privateKey: string; // base64url
}

export interface DeviceKeyBundle {
  identityKey: string;
  identitySigningKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: string[];
  deviceLabel: string;
}

export interface StoredDeviceKeys {
  identityKey: KeyPair;
  identitySigningKey: SigningKeyPair;
  signedPreKey: KeyPair;
  signedPreKeySignature: string;
  oneTimePreKeys: KeyPair[];
  consumedOneTimePreKeys?: KeyPair[];
  deviceLabel: string;
}

export interface RatchetHeader {
  ratchetKey: string;
  messageNumber: number;
  previousSendingNumber: number;
  nonce: string;
}

export interface EncryptedPayload {
  header: RatchetHeader;
  ciphertext: string;
  associatedData?: string;
}

export interface RatchetState {
  rootKey: string;
  sendingChainKey: string;
  receivingChainKey: string;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousSendingMessageNumber: number;
  localRatchetKey: KeyPair;
  remoteRatchetKey: string | null;
}

export interface SessionState {
  conversationId: string;
  partnerId: string;
  ratchetState: RatchetState;
  createdAt: number;
  updatedAt: number;
  awaitingPreKey?: string | null;
  messageKeyCache?: Record<string, string>;
}
