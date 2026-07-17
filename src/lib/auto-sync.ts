import { isAuthEnabled } from "@/lib/auth-flags";
import { hasPendingLocalChanges, pushPullSync } from "@/lib/sync-client";
import { useFinanceStore } from "@/store/finance-store";

/** Debounce: upload after this much quiet time since the last local edit. */
export const IDLE_SYNC_MS = 10 * 60 * 1000;

/** Avoid double leave-sync from visibilitychange + pagehide. */
const LEAVE_SYNC_COOLDOWN_MS = 2500;

const LOGIN_RETRY_DELAYS_MS = [0, 1500, 4000] as const;

/**
 * Post-failure backoff for idle / online sync (A6 / O2).
 * First attempt is immediate; then wait these delays before each retry (3 retries max).
 */
export const IDLE_ONLINE_RETRY_DELAYS_MS = [2_000, 8_000, 30_000] as const;

const BACKGROUND_SYNC_TAG = "openbalance-sync-pending";
const SW_SYNC_MESSAGE_TYPE = "OPENBALANCE_SYNC_PENDING";

let idleTimerId: ReturnType<typeof setTimeout> | null = null;
let storeUnsubscribe: (() => void) | null = null;
let pageLeaveBound = false;
let onlineBound = false;
let swMessageBound = false;
let activeSessionKey: string | null = null;
let isSyncInFlight = false;
let loginSyncGeneration = 0;
/** Bumps to cancel in-flight idle/online backoff loops. */
let retrySyncGeneration = 0;
let lastLeaveSyncAt = 0;

function clearIdleTimer() {
  if (idleTimerId == null) return;
  clearTimeout(idleTimerId);
  idleTimerId = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Pure helper: delay before retry attempt `retryIndex` (0 = first retry after failure).
 * Returns null when the index is out of range (attempts capped).
 */
export function getIdleOnlineRetryDelayMs(
  retryIndex: number,
  delaysMs: readonly number[] = IDLE_ONLINE_RETRY_DELAYS_MS,
): number | null {
  if (retryIndex < 0 || retryIndex >= delaysMs.length) return null;
  return delaysMs[retryIndex] ?? null;
}

async function runSyncSafely(options?: {
  keepalive?: boolean;
  /** Skip the request when there is nothing local to upload (saves server). */
  onlyIfDirty?: boolean;
}): Promise<boolean> {
  if (isSyncInFlight) return false;
  if (!isBrowserOnline()) {
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

/**
 * One immediate attempt, then up to IDLE_ONLINE_RETRY_DELAYS_MS.length retries
 * with exponential-ish backoff (2s → 8s → 30s). Used for idle + online (not leave).
 */
async function syncWithBackoffRetries(options?: {
  onlyIfDirty?: boolean;
}): Promise<boolean> {
  const generation = ++retrySyncGeneration;
  const sessionKey = activeSessionKey;

  const firstOk = await runSyncSafely(options);
  if (firstOk) return true;

  for (let retryIndex = 0; retryIndex < IDLE_ONLINE_RETRY_DELAYS_MS.length; retryIndex++) {
    const delayMs = getIdleOnlineRetryDelayMs(retryIndex);
    if (delayMs == null) break;
    if (generation !== retrySyncGeneration) return false;
    if (activeSessionKey !== sessionKey) return false;
    if (!isBrowserOnline()) {
      requestBackgroundSyncIfSupported();
      return false;
    }

    await sleep(delayMs);

    if (generation !== retrySyncGeneration) return false;
    if (activeSessionKey !== sessionKey) return false;
    if (!isBrowserOnline()) {
      requestBackgroundSyncIfSupported();
      return false;
    }
    if (options?.onlyIfDirty && !hasPendingLocalChanges()) return true;

    const ok = await runSyncSafely(options);
    if (ok) return true;
  }

  if (hasPendingLocalChanges()) {
    requestBackgroundSyncIfSupported();
  }
  return false;
}

function scheduleIdleSync() {
  if (!isAuthEnabled()) return;
  if (activeSessionKey == null) return;
  clearIdleTimer();
  idleTimerId = setTimeout(() => {
    idleTimerId = null;
    // Idle flush only if something actually changed since last sync.
    void syncWithBackoffRetries({ onlyIfDirty: true });
  }, IDLE_SYNC_MS);
}

/**
 * Ask the SW to wake us when the network is back (optional; browsers may no-op).
 */
function requestBackgroundSyncIfSupported() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  void navigator.serviceWorker.ready
    .then((registration) => {
      const syncManager = (
        registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        }
      ).sync;
      if (!syncManager?.register) return;
      return syncManager.register(BACKGROUND_SYNC_TAG);
    })
    .catch(() => {
      // Background Sync unsupported / denied — online listener still covers reconnect.
    });
}

/**
 * Replay pending local mutations through the existing push/pull engine (O2).
 * Shared by `online`, SW Background Sync postMessage, and visibility→visible
 * so reconnect does not wait for the 10m idle timer. No second sync queue.
 */
function replayPendingMutations() {
  if (!isAuthEnabled()) return;
  if (activeSessionKey == null) return;
  if (!hasPendingLocalChanges()) return;
  if (!isBrowserOnline()) {
    requestBackgroundSyncIfSupported();
    return;
  }
  void syncWithBackoffRetries({ onlyIfDirty: true });
}

/**
 * Flush pending local edits when the user leaves / backgrounds the app.
 * No-op when clean — minimizes server hits on tab switches with no edits.
 *
 * O4: `pushPullSync({ keepalive: true })` chunks bodies >50KB into multiple
 * keepalive POSTs. Background Sync remains a safety net for cancelled unload
 * fetches or a single entity that alone exceeds the keepalive limit.
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
  requestBackgroundSyncIfSupported();
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") {
    flushPendingOnLeave();
    return;
  }
  // Catch missed `online` while the tab was backgrounded (O2).
  if (document.visibilityState === "visible") {
    replayPendingMutations();
  }
}

/** Retry pending uploads as soon as the network comes back (A6 / O2). */
function onOnline() {
  replayPendingMutations();
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
  if (!isBrowserOnline()) {
    requestBackgroundSyncIfSupported();
  }
}

function onServiceWorkerMessage(event: MessageEvent) {
  if (!isAuthEnabled()) return;
  if (activeSessionKey == null) return;
  const data = event.data as { type?: string } | null;
  if (data?.type !== SW_SYNC_MESSAGE_TYPE) {
    return;
  }
  replayPendingMutations();
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

function bindOnlineListener() {
  if (onlineBound || typeof window === "undefined") return;
  window.addEventListener("online", onOnline);
  onlineBound = true;
}

function unbindOnlineListener() {
  if (!onlineBound || typeof window === "undefined") return;
  window.removeEventListener("online", onOnline);
  onlineBound = false;
}

function bindServiceWorkerMessageListener() {
  if (swMessageBound || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
  swMessageBound = true;
}

function unbindServiceWorkerMessageListener() {
  if (!swMessageBound || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.removeEventListener(
    "message",
    onServiceWorkerMessage,
  );
  swMessageBound = false;
}

async function syncOnLoginWithRetry(sessionKey: string) {
  const generation = ++loginSyncGeneration;
  for (const delayMs of LOGIN_RETRY_DELAYS_MS) {
    if (generation !== loginSyncGeneration) return;
    if (activeSessionKey !== sessionKey) return;
    if (delayMs > 0) {
      await sleep(delayMs);
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
 * - push after IDLE_SYNC_MS quiet time only if dirty (with backoff retries)
 * - push on tab hide / page leave only if dirty (keepalive, chunked if >50KB)
 * - push when the browser comes back online if dirty (with backoff retries)
 * - push when the tab becomes visible again if dirty (missed-online replay)
 * - optional Background Sync tag → SW postMessage → client retry
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
  bindOnlineListener();
  bindServiceWorkerMessageListener();

  void syncOnLoginWithRetry(sessionKey);
}

export function stopAutoSync() {
  loginSyncGeneration += 1;
  retrySyncGeneration += 1;
  activeSessionKey = null;
  clearIdleTimer();
  unbindPageLeaveListeners();
  unbindOnlineListener();
  unbindServiceWorkerMessageListener();
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
  }
}

/** Call after a successful credentials sign-in (before AppShell effects). */
export function triggerLoginSync(sessionKey = "session") {
  startAutoSync(sessionKey);
}
