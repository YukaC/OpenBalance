import { isAuthEnabled } from "@/lib/auth-flags";
import { hasPendingLocalChanges, pushPullSync } from "@/lib/sync-client";
import { useFinanceStore } from "@/store/finance-store";

/** Debounce: upload after this much quiet time since the last local edit. */
export const IDLE_SYNC_MS = 10 * 60 * 1000;

/** Avoid double leave-sync from visibilitychange + pagehide. */
const LEAVE_SYNC_COOLDOWN_MS = 2500;

const LOGIN_RETRY_DELAYS_MS = [0, 1500, 4000] as const;

let idleTimerId: ReturnType<typeof setTimeout> | null = null;
let storeUnsubscribe: (() => void) | null = null;
let pageLeaveBound = false;
let activeSessionKey: string | null = null;
let isSyncInFlight = false;
let loginSyncGeneration = 0;
let lastLeaveSyncAt = 0;

function clearIdleTimer() {
  if (idleTimerId == null) return;
  clearTimeout(idleTimerId);
  idleTimerId = null;
}

async function runSyncSafely(options?: {
  keepalive?: boolean;
  /** Skip the request when there is nothing local to upload (saves server). */
  onlyIfDirty?: boolean;
}): Promise<boolean> {
  if (isSyncInFlight) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  if (options?.onlyIfDirty && !hasPendingLocalChanges()) {
    return true;
  }
  isSyncInFlight = true;
  try {
    const result = await pushPullSync({ keepalive: options?.keepalive });
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
    // Idle flush only if something actually changed since last sync.
    void runSyncSafely({ onlyIfDirty: true });
  }, IDLE_SYNC_MS);
}

/**
 * Flush pending local edits when the user leaves / backgrounds the app.
 * No-op when clean — minimizes server hits on tab switches with no edits.
 */
function flushPendingOnLeave() {
  if (!isAuthEnabled()) return;
  if (activeSessionKey == null) return;
  if (!hasPendingLocalChanges()) return;

  const now = Date.now();
  if (now - lastLeaveSyncAt < LEAVE_SYNC_COOLDOWN_MS) return;
  lastLeaveSyncAt = now;

  clearIdleTimer();
  void runSyncSafely({ keepalive: true, onlyIfDirty: true });
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    flushPendingOnLeave();
  }
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

function bindPageLeaveListeners() {
  if (pageLeaveBound || typeof window === "undefined") return;
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flushPendingOnLeave);
  pageLeaveBound = true;
}

function unbindPageLeaveListeners() {
  if (!pageLeaveBound || typeof window === "undefined") return;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pagehide", flushPendingOnLeave);
  pageLeaveBound = false;
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
    // Login always push/pull (may need remote data even if local is clean).
    const ok = await runSyncSafely();
    if (ok) return;
  }
}

/**
 * Start automatic sync for an authenticated session:
 * - push/pull immediately on login (with short retries)
 * - push after IDLE_SYNC_MS quiet time only if dirty
 * - push on tab hide / page leave only if dirty (keepalive)
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
  bindPageLeaveListeners();

  void syncOnLoginWithRetry(sessionKey);
}

export function stopAutoSync() {
  loginSyncGeneration += 1;
  activeSessionKey = null;
  clearIdleTimer();
  unbindPageLeaveListeners();
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }
}

/** Call after a successful credentials sign-in (before AppShell effects). */
export function triggerLoginSync(sessionKey = "session") {
  startAutoSync(sessionKey);
}
