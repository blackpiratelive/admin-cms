/**
 * Client-Side E2EE Cryptography Engine using DEK / KEK Architecture.
 * - Key Encryption Key (KEK) is derived on unlock via Argon2id. Never stored.
 * - Data Encryption Key (DEK) is a 256-bit symmetric AES-256-GCM key that encrypts entries.
 * - DEK is encrypted using KEK and stored in database (journal_keys).
 * - Password changes re-wrap the DEK in milliseconds without touching journal entries.
 */

import { argon2id } from "hash-wasm";

export interface Argon2Params {
  memorySize?: number; // KiB (e.g. 65536 = 64MB)
  iterations?: number; // time cost (e.g. 3)
  parallelism?: number; // lanes (e.g. 1)
}

const DEFAULT_ARGON_PARAMS: Required<Argon2Params> = {
  memorySize: 65536,
  iterations: 3,
  parallelism: 1,
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}

export function generateIv(): string {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  return arrayBufferToBase64(iv.buffer);
}

/**
 * Derives Key Encryption Key (KEK) from password and salt using Argon2id.
 */
export async function deriveKEK(
  password: string,
  saltBase64: string,
  params: Argon2Params = DEFAULT_ARGON_PARAMS
): Promise<CryptoKey> {
  const saltBuffer = new Uint8Array(base64ToArrayBuffer(saltBase64));

  const binaryKek = await argon2id({
    password,
    salt: saltBuffer,
    parallelism: params.parallelism || DEFAULT_ARGON_PARAMS.parallelism,
    iterations: params.iterations || DEFAULT_ARGON_PARAMS.iterations,
    memorySize: params.memorySize || DEFAULT_ARGON_PARAMS.memorySize,
    hashLength: 32, // 256 bits
    outputType: "binary",
  });

  const kekBytes = new Uint8Array(binaryKek);

  const kekKey = await window.crypto.subtle.importKey(
    "raw",
    kekBytes,
    { name: "AES-GCM", length: 256 },
    false, // extractable = false for KEK security
    ["encrypt", "decrypt"]
  );

  // Zero out temporary binary buffer in memory
  binaryKek.fill(0);

  return kekKey;
}

/**
 * Generates a random 256-bit Data Encryption Key (DEK).
 */
export async function generateDEK(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable = true so it can be exported, encrypted with KEK, and rewrapped
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts (wraps) DEK using KEK.
 */
export async function wrapDEK(
  dekKey: CryptoKey,
  kekKey: CryptoKey
): Promise<{ encryptedDek: string; iv: string }> {
  const rawDek = await window.crypto.subtle.exportKey("raw", dekKey);
  const ivBase64 = generateIv();
  const ivBuffer = base64ToArrayBuffer(ivBase64);

  const encryptedDekBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBuffer },
    kekKey,
    rawDek
  );

  // Zero-fill exported raw DEK buffer for memory safety
  new Uint8Array(rawDek).fill(0);

  return {
    encryptedDek: arrayBufferToBase64(encryptedDekBuffer),
    iv: ivBase64,
  };
}

/**
 * Decrypts (unwraps) DEK using KEK.
 */
export async function unwrapDEK(
  encryptedDekBase64: string,
  ivBase64: string,
  kekKey: CryptoKey
): Promise<CryptoKey> {
  const encryptedDekBuffer = base64ToArrayBuffer(encryptedDekBase64);
  const ivBuffer = base64ToArrayBuffer(ivBase64);

  const decryptedRawDek = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    kekKey,
    encryptedDekBuffer
  );

  const dekKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedRawDek,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Zero out decrypted raw buffer in memory
  new Uint8Array(decryptedRawDek).fill(0);

  return dekKey;
}

/**
 * Encrypts entry plaintext using DEK.
 */
export async function encryptText(
  plaintext: string,
  dekKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const rawIv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: rawIv },
    dekKey,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(rawIv.buffer),
  };
}

/**
 * Decrypts entry ciphertext using DEK.
 */
export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  dekKey: CryptoKey
): Promise<string> {
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const ivBuffer = base64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    dekKey,
    ciphertextBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

export async function createVerificationPayload(
  dekKey: CryptoKey
): Promise<{ verificationPayload: string; verificationIv: string }> {
  const res = await encryptText("VERIFIED_JOURNAL_KEY", dekKey);
  return {
    verificationPayload: res.ciphertext,
    verificationIv: res.iv,
  };
}

export async function verifyDEK(
  dekKey: CryptoKey,
  verificationPayloadBase64: string,
  verificationIvBase64: string
): Promise<boolean> {
  try {
    const decrypted = await decryptText(verificationPayloadBase64, verificationIvBase64, dekKey);
    return decrypted === "VERIFIED_JOURNAL_KEY";
  } catch (err) {
    return false;
  }
}
