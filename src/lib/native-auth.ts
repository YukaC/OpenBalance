/**
 * Capacitor native auth token (C1).
 *
 * Cookies often fail across WebView origin → Vercel. On native we store an
 * Auth.js-compatible encrypted JWT in Preferences and send it as
 * `Authorization: Bearer` on sync. Web keeps cookie sessions.
 */

import { getApiBaseUrl } from "@/lib/auth-flags";
import { isRunningInNativeApp } from "@/lib/device";

export const NATIVE_AUTH_TOKEN_KEY = "rinde-native-auth-token";
export const NATIVE_AUTH_CHANGED_EVENT = "rinde-native-auth-changed";

const LOCAL_FALLBACK_KEY = NATIVE_AUTH_TOKEN_KEY;

async function readPreferencesValue(key: string): Promise<string | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const result = await Preferences.get({ key });
    return result.value ?? null;
  } catch {
    return null;
  }
}

async function writePreferencesValue(key: string, value: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

async function removePreferencesValue(key: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    /* ignore */
  }
}

function notifyNativeAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NATIVE_AUTH_CHANGED_EVENT));
}

export async function getNativeAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (isRunningInNativeApp()) {
    const fromPreferences = await readPreferencesValue(NATIVE_AUTH_TOKEN_KEY);
    if (fromPreferences) return fromPreferences;
  }

  try {
    return window.localStorage.getItem(LOCAL_FALLBACK_KEY);
  } catch {
    return null;
  }
}

export async function setNativeAuthToken(token: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (isRunningInNativeApp()) {
    try {
      await writePreferencesValue(NATIVE_AUTH_TOKEN_KEY, token);
    } catch {
      // Fall through to localStorage if Preferences fails.
    }
  }

  try {
    window.localStorage.setItem(LOCAL_FALLBACK_KEY, token);
  } catch {
    /* ignore */
  }

  notifyNativeAuthChanged();
}

export async function clearNativeAuthToken(): Promise<void> {
  if (typeof window === "undefined") return;

  if (isRunningInNativeApp()) {
    await removePreferencesValue(NATIVE_AUTH_TOKEN_KEY);
  }

  try {
    window.localStorage.removeItem(LOCAL_FALLBACK_KEY);
  } catch {
    /* ignore */
  }

  notifyNativeAuthChanged();
}

export async function hasNativeAuthToken(): Promise<boolean> {
  const token = await getNativeAuthToken();
  return Boolean(token);
}

/**
 * Headers for authenticated API calls. On native, attach Bearer when present.
 * Always keep credentials: "include" so cookie sessions still work on web.
 */
export async function getSyncAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!isRunningInNativeApp()) return headers;

  const token = await getNativeAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export type NativeLoginResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Password login that returns a bearer JWT for Capacitor (no cookie dependency).
 */
export async function loginNativeWithPassword(
  email: string,
  password: string,
): Promise<NativeLoginResult> {
  const apiBase = getApiBaseUrl();
  try {
    const response = await fetch(`${apiBase}/api/auth/native-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    if (!response.ok) {
      let message = "Email o contraseña incorrectos.";
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error === "Database unavailable") {
          message = "El servidor no está disponible todavía.";
        } else if (payload.error === "AUTH_SECRET_MISSING") {
          message = "Auth no está configurado en el servidor.";
        }
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }

    const payload = (await response.json()) as { token?: string };
    if (!payload.token) {
      return { ok: false, error: "Respuesta de login inválida." };
    }

    await setNativeAuthToken(payload.token);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar con el servidor. Revisá tu conexión.",
    };
  }
}
