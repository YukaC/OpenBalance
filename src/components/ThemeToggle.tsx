"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  getInitialTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({
  className = "",
  compact = false,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setIsReady(true);
  }, []);

  function handleToggle() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const isDark = theme === "dark";

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        disabled={!isReady}
        onClick={handleToggle}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)] transition-soft hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {isDark ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      disabled={!isReady}
      onClick={handleToggle}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] shadow-[var(--shadow-card)] transition-soft hover:border-[var(--line-strong)] focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg)] text-[var(--ink-soft)]"
          aria-hidden
        >
          {isDark ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </span>
        {isDark ? "Modo oscuro" : "Modo claro"}
      </span>

      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          isDark ? "bg-[var(--ink)]" : "bg-[var(--paper-deep)]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-transform ${
            isDark
              ? "left-4 bg-[var(--ink-contrast)]"
              : "left-0.5 bg-[var(--ink)]"
          }`}
        />
      </span>
    </button>
  );
}
