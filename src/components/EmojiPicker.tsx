"use client";

import { CATEGORY_EMOJIS } from "@/lib/category-emojis";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  label?: string;
  /** When true, emoji grid gets its own scrollbar. Prefer false so only section lists scroll. */
  hasScroll?: boolean;
  compact?: boolean;
}

export function EmojiPicker({
  value,
  onChange,
  label = "Ícono",
  hasScroll = false,
  compact = false,
}: EmojiPickerProps) {
  return (
    <fieldset className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      <legend
        className={`font-semibold text-[var(--ink-soft)] ${
          compact ? "text-[11px]" : "text-[12px]"
        }`}
      >
        {label}
      </legend>

      {compact ? null : (
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--bg)] text-[22px] leading-none"
            aria-hidden
          >
            {value}
          </span>
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            Elegí un emoji de la grilla. No hace falta escribirlo.
          </p>
        </div>
      )}

      <div
        role="listbox"
        aria-label="Emojis disponibles"
        className={`grid grid-cols-8 gap-1 rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] p-1.5 sm:grid-cols-10 ${
          hasScroll
            ? "max-h-[120px] overflow-y-auto overscroll-contain"
            : ""
        } ${compact ? "gap-1" : "gap-1.5 p-2"}`}
      >
        {CATEGORY_EMOJIS.map((emoji) => {
          const isSelected = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={`Elegir emoji ${emoji}`}
              title={emoji}
              onClick={() => onChange(emoji)}
              className={`flex w-full items-center justify-center rounded-[8px] leading-none transition-soft ${
                compact ? "h-7 text-[15px]" : "h-9 text-[18px]"
              } ${
                isSelected
                  ? "bg-[var(--select-soft)] ring-2 ring-[var(--select)] scale-105"
                  : "hover:bg-[var(--bg)] hover:scale-105 active:scale-95"
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
