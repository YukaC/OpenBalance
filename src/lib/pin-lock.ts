/**
 * Optional local PIN lock — SHA-256 verify + PBKDF2 session key in memory.
 * The PIN never leaves the device and must never be sent to the server
 * (including `/api/sync`).
 */

import { deriveKeyFromPin } from "@/lib/crypto-store";

export const PIN_LOCK_STORAGE_KEY = "openbalance-lock";

export interface PinLockRecord {
  salt: string;
  hash: string;
}

const PIN_PATTERN = /^\d{4,6}$/;

/** In-memory AES key derived from PIN after unlock; cleared on lock/disable. */
let sessionCryptoKey: CryptoKey | null = null;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const payload = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return toHex(new Uint8Array(digest));
}

function parsePinLockRaw(raw: string): PinLockRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PinLockRecord>;
    if (
      typeof parsed.salt !== "string" ||
      typeof parsed.hash !== "string" ||
      !parsed.salt ||
      !parsed.hash
    ) {
      return null;
    }
    return { salt: parsed.salt, hash: parsed.hash };
  } catch {
    return null;
  }
}

export function readPinLock(): PinLockRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const currentRaw = window.localStorage.getItem(PIN_LOCK_STORAGE_KEY);
    if (!currentRaw) return null;
    return parsePinLockRaw(currentRaw);
  } catch {
    return null;
  }
}

export function isPinEnabled(): boolean {
  return readPinLock() !== null;
}

export function getSessionCryptoKey(): CryptoKey | null {
  return sessionCryptoKey;
}

export function hasSessionCryptoKey(): boolean {
  return sessionCryptoKey !== null;
}

export function clearSessionCryptoKey(): void {
  sessionCryptoKey = null;
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be 4–6 digits");
  }
  const salt = createSalt();
  const hash = await hashPin(pin, salt);
  window.localStorage.setItem(
    PIN_LOCK_STORAGE_KEY,
    JSON.stringify({ salt, hash } satisfies PinLockRecord),
  );
  // Keep a session key so the next persist write encrypts the finance blob.
  sessionCryptoKey = await deriveKeyFromPin(pin, salt);
}

/**
 * Verify PIN and load the derived AES key into memory for encrypted storage.
 * Returns false on bad PIN; does not throw.
 */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const record = readPinLock();
  if (!record) return false;
  if (!isValidPinFormat(pin)) return false;
  const hash = await hashPin(pin, record.salt);
  if (hash !== record.hash) return false;
  sessionCryptoKey = await deriveKeyFromPin(pin, record.salt);
  return true;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const record = readPinLock();
  if (!record) return false;
  if (!isValidPinFormat(pin)) return false;
  const hash = await hashPin(pin, record.salt);
  return hash === record.hash;
}

export function clearPin(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_LOCK_STORAGE_KEY);
  sessionCryptoKey = null;
}

/**
 * Disable PIN after verifying: drop lock record, clear session key.
 * Caller should touch the finance store so persist rewrites plaintext.
 */
export async function disablePinWithVerification(pin: string): Promise<boolean> {
  const unlocked = await unlockWithPin(pin);
  if (!unlocked) return false;
  clearPin();
  return true;
}
