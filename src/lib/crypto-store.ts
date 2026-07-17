/**
 * Local-only Web Crypto helpers for finance persist blobs.
 * PIN / derived keys never leave the device and must never be sent to the server
 * (including `/api/sync`).
 */

const PBKDF2_ITERATIONS = 210_000;
const AES_KEY_BITS = 256;
const IV_BYTES = 12;

/** Envelope marker so we can tell ciphertext apart from plaintext JSON. */
export const ENCRYPTED_BLOB_MARKER = 1 as const;

export interface EncryptedBlob {
  __openBalanceEnc?: typeof ENCRYPTED_BLOB_MARKER;
  iv: string;
  ciphertext: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<EncryptedBlob>;
  return (
    record.__openBalanceEnc === ENCRYPTED_BLOB_MARKER &&
    typeof record.iv === "string" &&
    typeof record.ciphertext === "string" &&
    record.iv.length > 0 &&
    record.ciphertext.length > 0
  );
}

export function createCryptoSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Derive an AES-GCM key from the local PIN (PBKDF2-SHA-256). */
export async function deriveKeyFromPin(
  pin: string,
  saltHex: string,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(
  value: unknown,
  key: CryptoKey,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return {
    __openBalanceEnc: ENCRYPTED_BLOB_MARKER,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptJson<T = unknown>(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  const json = new TextDecoder().decode(plainBuffer);
  return JSON.parse(json) as T;
}
