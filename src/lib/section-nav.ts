"use client";

import { createContext, useContext } from "react";

export const APP_SECTIONS = [
  "/",
  "/transacciones",
  "/categorias",
  "/configuracion",
] as const;

export type AppSection = (typeof APP_SECTIONS)[number];

export function normalizeSection(pathname: string): AppSection {
  if (
    pathname === "/" ||
    pathname === "" ||
    pathname === "/semanas" ||
    pathname.startsWith("/semanas/")
  ) {
    return "/";
  }
  for (const section of APP_SECTIONS) {
    if (section === "/") continue;
    if (pathname === section || pathname.startsWith(`${section}/`)) {
      return section;
    }
  }
  return "/";
}

export type SectionNavContextValue = {
  section: AppSection;
  navigateToSection: (href: string) => void;
};

export const SectionNavContext = createContext<SectionNavContextValue | null>(
  null,
);

export function useSectionNav(): SectionNavContextValue {
  const value = useContext(SectionNavContext);
  if (!value) {
    throw new Error("useSectionNav must be used within AppShell");
  }
  return value;
}

/** Safe when a consumer might render without provider; no-ops outside AppShell. */
export function useNavigateToSection(): (href: string) => void {
  const value = useContext(SectionNavContext);
  return value?.navigateToSection ?? (() => undefined);
}
