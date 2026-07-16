"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CurrencyCode } from "@/lib/format";

const CurrencyContext = createContext<CurrencyCode>("ARS");

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: CurrencyCode;
  children: ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Default display currency from AppShell; falls back to ARS outside the provider. */
export function useDefaultCurrency(): CurrencyCode {
  return useContext(CurrencyContext);
}
