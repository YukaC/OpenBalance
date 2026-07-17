"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>;
  isActive: boolean;
  /** Element to focus when the trap activates. Defaults to the first focusable node. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  /** Used when the previously focused element is gone (e.g. modal closed). */
  fallbackFocusSelector?: string;
}

export function useFocusTrap({
  containerRef,
  isActive,
  initialFocusRef,
  onEscape,
  fallbackFocusSelector,
}: UseFocusTrapOptions) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isActive) return;

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const initialFocus =
      initialFocusRef?.current ??
      container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = containerRef.current;
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previousElement = previousActiveElementRef.current;
      if (
        previousElement &&
        typeof previousElement.focus === "function" &&
        document.contains(previousElement)
      ) {
        previousElement.focus();
      } else if (fallbackFocusSelector) {
        document.querySelector<HTMLElement>(fallbackFocusSelector)?.focus();
      }
    };
  }, [isActive, containerRef, initialFocusRef, fallbackFocusSelector]);
}
