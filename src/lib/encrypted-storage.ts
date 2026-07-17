/**
 * Zustand PersistStorage that AES-GCM-encrypts the finance blob when a session
 * crypto key is present (PIN unlocked). Without a PIN/key, stores plaintext.
 * PIN never leaves the device / never hits the server.
 */

import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
  type EncryptedBlob,
} from "@/lib/crypto-store";
import { getSessionCryptoKey, isPinEnabled } from "@/lib/pin-lock";
import type { PersistStorage, StorageValue } from "zustand/middleware";

/** Versioned persist key (S2: IndexedDB primary; localStorage legacy fallback). */
export const FINANCE_STORAGE_NAME = "rinde-finance-v4";
const LEGACY_LOCAL_STORAGE_NAME = "rinde-finance-v3";

const IDB_NAME = "rinde-db";
const IDB_STORE = "persist";
const IDB_VERSION = 1;

/** True when the last getItem saw ciphertext but no session key (locked). */
let wasLastGetLockedCiphertext = false;

export function consumeWasLastGetLockedCiphertext(): boolean {
  const value = wasLastGetLockedCiphertext;
  wasLastGetLockedCiphertext = false;
  return value;
}

export function peekWasLastGetLockedCiphertext(): boolean {
  return wasLastGetLockedCiphertext;
}

function openPersistDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openPersistDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onerror = () => reject(request.error ?? new Error("IDB get failed"));
      request.onsuccess = () => {
        const result = request.result;
        resolve(typeof result === "string" ? result : null);
      };
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openPersistDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error ?? new Error("IDB put failed"));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IDB write failed"));
  });
}

async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openPersistDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const request = store.delete(key);
      request.onerror = () =>
        reject(request.error ?? new Error("IDB delete failed"));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
    });
  } catch {
    /* ignore */
  }
}

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function removeLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

/** Sync peek for lock UI before async hydrate finishes. */
export function hasEncryptedFinanceBlobSync(): boolean {
  const raw =
    readLocalStorage(FINANCE_STORAGE_NAME) ??
    readLocalStorage(LEGACY_LOCAL_STORAGE_NAME);
  if (!raw) return false;
  try {
    return isEncryptedBlob(JSON.parse(raw));
  } catch {
    return false;
  }
}

async function readRaw(name: string): Promise<string | null> {
  const fromIdb = await idbGet(name);
  if (fromIdb) return fromIdb;

  const fromLocalV4 = readLocalStorage(name);
  if (fromLocalV4) return fromLocalV4;

  if (name === FINANCE_STORAGE_NAME) {
    const legacy = readLocalStorage(LEGACY_LOCAL_STORAGE_NAME);
    if (legacy) return legacy;
  }
  return null;
}

async function writeRaw(name: string, value: string): Promise<void> {
  try {
    await idbSet(name, value);
  } catch {
    writeLocalStorage(name, value);
    return;
  }
  // Keep a localStorage mirror for sync ciphertext detection + recovery.
  writeLocalStorage(name, value);
  if (name === FINANCE_STORAGE_NAME) {
    removeLocalStorage(LEGACY_LOCAL_STORAGE_NAME);
  }
}

async function removeRaw(name: string): Promise<void> {
  await idbRemove(name);
  removeLocalStorage(name);
  if (name === FINANCE_STORAGE_NAME) {
    removeLocalStorage(LEGACY_LOCAL_STORAGE_NAME);
  }
}

function parseStoredRaw(raw: string): EncryptedBlob | StorageValue<unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isEncryptedBlob(parsed)) return parsed;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "state" in parsed
    ) {
      return parsed as StorageValue<unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function createEncryptedPersistStorage<S>(): PersistStorage<S, Promise<void>> {
  return {
    getItem: async (name) => {
      wasLastGetLockedCiphertext = false;
      const raw = await readRaw(name);
      if (!raw) return null;

      const parsed = parseStoredRaw(raw);
      if (!parsed) return null;

      if (isEncryptedBlob(parsed)) {
        const key = getSessionCryptoKey();
        if (!key) {
          wasLastGetLockedCiphertext = true;
          return null;
        }
        try {
          return await decryptJson<StorageValue<S>>(parsed, key);
        } catch {
          wasLastGetLockedCiphertext = true;
          return null;
        }
      }

      return parsed as StorageValue<S>;
    },

    setItem: async (name, value) => {
      const existingRaw = await readRaw(name);
      const existingParsed = existingRaw ? parseStoredRaw(existingRaw) : null;
      const key = getSessionCryptoKey();

      // Never clobber ciphertext while PIN is still enabled but session locked.
      // After clearPin(), allow rewrite to plaintext.
      if (isEncryptedBlob(existingParsed) && !key && isPinEnabled()) {
        return;
      }

      if (key) {
        const encrypted = await encryptJson(value, key);
        await writeRaw(name, JSON.stringify(encrypted));
        return;
      }

      await writeRaw(name, JSON.stringify(value));
    },

    removeItem: async (name) => {
      await removeRaw(name);
    },
  };
}
