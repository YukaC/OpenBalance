"use client";

import { useEffect, useRef } from "react";
import { FOCUS_RING } from "@/lib/focus-ring";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const list = [...nodes].filter((node) => !node.hasAttribute("disabled"));
      if (list.length === 0) return;

      const first = list[0];
      const last = list[list.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      const previousElement = previousActiveElementRef.current;
      if (
        previousElement &&
        typeof previousElement.focus === "function" &&
        document.contains(previousElement)
      ) {
        previousElement.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ink)]/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="font-display text-[18px] font-semibold text-[var(--ink)]"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]"
        >
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className={`min-h-10 rounded-xl px-4 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-10 rounded-xl px-4 text-[13px] font-bold transition-soft ${FOCUS_RING} ${
              isDestructive
                ? "bg-[var(--red)] text-white hover:opacity-90"
                : "bg-[var(--select)] text-[var(--chip-active-text)] hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
