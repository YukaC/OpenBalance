"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker in production only.
 * Dev stays unregistered so HMR and Next chunks are never stale-cached.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Private mode / unsupported — shell still works online.
    });
  }, []);

  return null;
}
