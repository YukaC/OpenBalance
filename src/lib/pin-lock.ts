/** Optional local PIN lock — SHA-256 + salt in `rinde-lock` localStorage. */

export const PIN_LOCK_STORAGE_KEY = "rinde-lock";

export interface PinLockRecord {
  salt: string;
  hash: string;
}

const PIN_PATTERN = /^\d{4,6}$/;

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

export function readPinLock(): PinLockRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIN_LOCK_STORAGE_KEY);
    if (!raw) return null;
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

export function isPinEnabled(): boolean {
  return readPinLock() !== null;
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
}
