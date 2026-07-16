"use client";

import { useEffect } from "react";
import { FOCUS_RING } from "@/lib/focus-ring";
import { useToastStore } from "@/store/toast-store";

export function AppToast() {
  const message = useToastStore((s) => s.message);
  const actionLabel = useToastStore((s) => s.actionLabel);
  const onAction = useToastStore((s) => s.onAction);
  const durationMs = useToastStore((s) => s.durationMs);
  const hideToast = useToastStore((s) => s.hideToast);

  useEffect(() => {
    if (!message) return;
    const timerId = window.setTimeout(() => hideToast(), durationMs);
    return () => window.clearTimeout(timerId);
  }, [message, durationMs, hideToast]);

  if (!message) return null;

  function handleAction() {
    onAction?.();
    hideToast();
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 max-[879px]:bottom-[calc(var(--nav-h)+12px)] min-[880px]:bottom-6"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-card)]">
        <p className="min-w-0 flex-1 text-[13.5px] font-medium text-[var(--ink)]">
          {message}
        </p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={handleAction}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-bold text-[var(--select-fg)] transition-soft hover:bg-[var(--select-soft)] ${FOCUS_RING}`}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
