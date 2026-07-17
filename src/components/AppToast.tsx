"use client";

import { useEffect, useRef, useState } from "react";
import { FOCUS_RING } from "@/lib/focus-ring";
import { useToastStore } from "@/store/toast-store";

export function AppToast() {
  const message = useToastStore((s) => s.message);
  const actionLabel = useToastStore((s) => s.actionLabel);
  const onAction = useToastStore((s) => s.onAction);
  const durationMs = useToastStore((s) => s.durationMs);
  const hideToast = useToastStore((s) => s.hideToast);

  const [isPaused, setIsPaused] = useState(false);
  const remainingMsRef = useRef(durationMs);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!message) return;
    remainingMsRef.current = durationMs;
    setIsPaused(false);
  }, [message, durationMs]);

  useEffect(() => {
    if (!message || isPaused) return;

    startedAtRef.current = Date.now();
    const timerId = window.setTimeout(() => {
      hideToast();
    }, remainingMsRef.current);

    return () => {
      window.clearTimeout(timerId);
      const elapsed = Date.now() - startedAtRef.current;
      remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    };
  }, [message, durationMs, hideToast, isPaused]);

  if (!message) return null;

  function handleAction() {
    onAction?.();
    hideToast();
  }

  function handlePause() {
    setIsPaused(true);
  }

  function handleResume() {
    setIsPaused(false);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center pl-[var(--page-pad-left)] pr-[var(--page-pad-right)] max-[879px]:bottom-[calc(var(--nav-h)+12px)] min-[880px]:bottom-6"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-card)]"
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        onFocusCapture={handlePause}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            handleResume();
          }
        }}
      >
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
        <button
          type="button"
          onClick={hideToast}
          aria-label="Cerrar"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[16px] leading-none text-[var(--ink-faint)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
