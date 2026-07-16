"use client";

import { useEffect, useState } from "react";
import { FOCUS_RING } from "@/lib/focus-ring";
import {
  applyTheme,
  getInitialTheme,
  nextThemeMode,
  resolveTheme,
  subscribeSystemTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

const THEME_ARIA_LABEL: Record<ThemeMode, string> = {
  light: "Tema claro. Clic para modo oscuro",
  dark: "Tema oscuro. Clic para seguir al sistema",
  system: "Tema del sistema. Clic para modo claro",
};

const THEME_LABEL: Record<ThemeMode, string> = {
  light: "Modo claro",
  dark: "Modo oscuro",
  system: "Según sistema",
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "dark") {
    return (
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
    );
  }
  if (mode === "system") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }
  return (
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
  );
}

export function ThemeToggle({
  className = "",
  compact = false,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setResolved(resolveTheme(initial));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (theme !== "system") {
      setResolved(resolveTheme(theme));
      return;
    }
    setResolved(resolveTheme("system"));
    return subscribeSystemTheme(() => {
      applyTheme("system");
      setResolved(resolveTheme("system"));
    });
  }, [theme]);

  function handleToggle() {
    const next = nextThemeMode(theme);
    setTheme(next);
    applyTheme(next);
    setResolved(resolveTheme(next));
  }

  const isDark = resolved === "dark";

  if (compact) {
    return (
      <button
        type="button"
        aria-label={THEME_ARIA_LABEL[theme]}
        disabled={!isReady}
        onClick={handleToggle}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)] transition-soft hover:border-[var(--ink)] hover:text-[var(--ink)] ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <ThemeIcon mode={theme} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={THEME_ARIA_LABEL[theme]}
      disabled={!isReady}
      onClick={handleToggle}
      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[13px] font-semibold text-[var(--ink)] shadow-[var(--shadow-card)] transition-soft hover:border-[var(--line-strong)] ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg)] text-[var(--ink-soft)]"
          aria-hidden
        >
          <ThemeIcon mode={theme} />
        </span>
        {THEME_LABEL[theme]}
      </span>

      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          isDark ? "bg-[var(--ink)]" : "bg-[var(--paper-deep)]"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-transform ${
            theme === "system"
              ? "left-[7px] bg-[var(--ink-soft)]"
              : isDark
                ? "left-4 bg-[var(--ink-contrast)]"
                : "left-0.5 bg-[var(--ink)]"
          }`}
        />
      </span>
    </button>
  );
}
