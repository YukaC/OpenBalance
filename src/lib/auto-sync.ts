import { isAuthEnabled } from "@/lib/auth-flags";
import { pushPullSync } from "@/lib/sync-client";
import { useFinanceStore } from "@/store/finance-store";

/** Debounce: upload after this much quiet time since the last local edit. */
export const IDLE_SYNC_MS = 10 * 60 * 1000;

const LOGIN_RETRY_DELAYS_MS = [0, 1500, 4000] as const;

let idleTimerId: ReturnType<typeof setTimeout> | null = null;
let storeUnsubscribe: (() => void) | null = null;
let activeSessionKey: string | null = null;
let isSyncInFlight = false;
let loginSyncGeneration = 0;

function clearIdleTimer() {
  if (idleTimerId == null) return;
  clearTimeout(idleTimerId);
  idleTimerId = null;
}

async function runSyncSafely(): Promise<boolean> {
  if (isSyncInFlight) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  isSyncInFlight = true;
  try {
    const result = await pushPullSync();
    return result.ok;
  } finally {
    isSyncInFlight = false;
  }
}

function scheduleIdleSync() {
  if (!isAuthEnabled()) return;
  if (activeSessionKey == null) return;
  clearIdleTimer();
  idleTimerId = setTimeout(() => {
    idleTimerId = null;
    void runSyncSafely();
  }, IDLE_SYNC_MS);
}

function onStoreChanged(
  state: ReturnType<typeof useFinanceStore.getState>,
  previous: ReturnType<typeof useFinanceStore.getState>,
) {
  if (activeSessionKey == null) return;
  // Ignore remote merges that only bump lastSyncedAt.
  if (
    state.transactions === previous.transactions &&
    state.categories === previous.categories &&
    state.budgets === previous.budgets &&
    state.incomeSources === previous.incomeSources &&
    state.userRules === previous.userRules &&
    state.accounts === previous.accounts &&
    state.profile === previous.profile
  ) {
    return;
  }
  scheduleIdleSync();
}

async function syncOnLoginWithRetry(sessionKey: string) {
  const generation = ++loginSyncGeneration;
  for (const delayMs of LOGIN_RETRY_DELAYS_MS) {
    if (generation !== loginSyncGeneration) return;
    if (activeSessionKey !== sessionKey) return;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (generation !== loginSyncGeneration) return;
    if (activeSessionKey !== sessionKey) return;
    const ok = await runSyncSafely();
    if (ok) return;
  }
}

/**
 * Start automatic sync for an authenticated session:
 * - push/pull immediately on login (with short retries)
 * - push/pull again after IDLE_SYNC_MS with no local edits
 */
export function startAutoSync(sessionKey: string) {
  if (!isAuthEnabled()) {
    stopAutoSync();
    return;
  }
  if (!sessionKey) return;

  if (activeSessionKey === sessionKey && storeUnsubscribe) {
    return;
  }

  stopAutoSync();
  activeSessionKey = sessionKey;

  if (!storeUnsubscribe) {
    storeUnsubscribe = useFinanceStore.subscribe(onStoreChanged);
  }

  void syncOnLoginWithRetry(sessionKey);
}

export function stopAutoSync() {
  loginSyncGeneration += 1;
  activeSessionKey = null;
  clearIdleTimer();
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }
}

/** Call after a successful credentials sign-in (before AppShell effects). */
export function triggerLoginSync(sessionKey = "session") {
  startAutoSync(sessionKey);
}
