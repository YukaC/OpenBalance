"use client";

import { create } from "zustand";

const DEFAULT_DURATION_MS = 4000;

interface ShowToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastState {
  message: string | null;
  actionLabel: string | null;
  onAction: (() => void) | null;
  durationMs: number;
  showToast: (options: ShowToastOptions) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  actionLabel: null,
  onAction: null,
  durationMs: DEFAULT_DURATION_MS,
  showToast: ({ message, actionLabel, onAction, durationMs }) =>
    set({
      message,
      actionLabel: actionLabel ?? null,
      onAction: onAction ?? null,
      durationMs: durationMs ?? DEFAULT_DURATION_MS,
    }),
  hideToast: () =>
    set({
      message: null,
      actionLabel: null,
      onAction: null,
    }),
}));
