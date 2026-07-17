"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  bindNativeBackButton,
  bindOverlayHistoryBack,
} from "@/lib/android-back";
import { CurrencyProvider } from "@/lib/currency-context";
import { startAutoSync, stopAutoSync } from "@/lib/auto-sync";
import { isAuthEnabled } from "@/lib/auth-flags";
import { bindDeepLinkListeners } from "@/lib/deep-links";
import { FOCUS_RING } from "@/lib/focus-ring";
import { WEEKDAY_LABELS } from "@/lib/format";
import {
  NATIVE_AUTH_CHANGED_EVENT,
  hasNativeAuthToken,
} from "@/lib/native-auth";
import { hapticLightImpact } from "@/lib/native-haptics";
import { hideNativeSplash } from "@/lib/native-splash";
import { isPinEnabled } from "@/lib/pin-lock";
import { needsProfileSetup } from "@/lib/profile-setup";
import {
  normalizeSection,
  SectionNavContext,
  type AppSection,
} from "@/lib/section-nav";
import { useFinanceStore } from "@/store/finance-store";
import { PaydayLoadBanner } from "@/components/PaydayLoadBanner";
import { AppToast } from "@/components/AppToast";
import { SyncStatusChip } from "@/components/SyncStatusChip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ViewSkeleton } from "@/components/ViewSkeleton";

function SectionLoading() {
  return <ViewSkeleton />;
}

const CHUNK_RELOAD_KEY = "openbalance-chunk-reload";

function readChunkReloadFlag(): boolean {
  return Boolean(sessionStorage.getItem(CHUNK_RELOAD_KEY));
}

function clearChunkReloadFlag(): void {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}

function importWithChunkRetry<T>(
  importer: () => Promise<T>,
): Promise<T> {
  return importer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const isChunkError =
      (error instanceof Error && error.name === "ChunkLoadError") ||
      /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(
        message,
      );
    if (isChunkError && typeof window !== "undefined") {
      try {
        if (!readChunkReloadFlag()) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          window.location.reload();
          return new Promise<T>(() => {});
        }
        clearChunkReloadFlag();
      } catch {
        /* ignore storage failures */
      }
    }
    throw error;
  });
}

const ResumenView = dynamic(
  () => importWithChunkRetry(() => import("@/views/ResumenView")),
  { loading: SectionLoading },
);
const TransaccionesView = dynamic(
  () => importWithChunkRetry(() => import("@/views/TransaccionesView")),
  { loading: SectionLoading },
);
const CategoriasView = dynamic(
  () => importWithChunkRetry(() => import("@/views/CategoriasView")),
  { loading: SectionLoading },
);
const ConfiguracionView = dynamic(
  () => importWithChunkRetry(() => import("@/views/ConfiguracionView")),
  { loading: SectionLoading },
);
const TransactionForm = dynamic(
  () =>
    importWithChunkRetry(() =>
      import("@/components/TransactionForm").then((mod) => ({
        default: mod.TransactionForm,
      })),
    ),
  { loading: () => null },
);
const OnboardingScreen = dynamic(
  () =>
    importWithChunkRetry(() =>
      import("@/components/OnboardingScreen").then((mod) => ({
        default: mod.OnboardingScreen,
      })),
    ),
  { loading: SectionLoading },
);
const AuthScreen = dynamic(
  () =>
    importWithChunkRetry(() =>
      import("@/components/AuthScreen").then((mod) => ({
        default: mod.AuthScreen,
      })),
    ),
  { loading: SectionLoading },
);
const PinUnlockScreen = dynamic(
  () =>
    importWithChunkRetry(() =>
      import("@/components/PinUnlockScreen").then((mod) => ({
        default: mod.PinUnlockScreen,
      })),
    ),
  { loading: SectionLoading },
);

const MAIN_NAV_ITEMS = [
  {
    href: "/",
    label: "Resumen",
    short: "Resumen",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="2" />
        <rect x="14" y="3" width="7" height="5" rx="2" />
        <rect x="14" y="12" width="7" height="9" rx="2" />
        <rect x="3" y="16" width="7" height="5" rx="2" />
      </svg>
    ),
  },
  {
    href: "/transacciones",
    label: "Transacciones",
    short: "Movs.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: "/categorias",
    label: "Categorías",
    short: "Categ.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3 v9 l6 3" />
      </svg>
    ),
  },
] as const;

function isActivePath(section: string, href: string): boolean {
  if (href === "/") return section === "/";
  return section === href || section.startsWith(`${href}/`);
}

function renderActiveSection(section: AppSection) {
  switch (section) {
    case "/transacciones":
      return <TransaccionesView />;
    case "/categorias":
      return <CategoriasView />;
    case "/configuracion":
      return <ConfiguracionView />;
    case "/":
    default:
      return <ResumenView />;
  }
}

function SectionNavButton({
  href,
  className,
  children,
  ariaLabel,
  isCurrent,
  onNavigate,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  ariaLabel?: string;
  isCurrent?: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      aria-current={isCurrent ? "page" : undefined}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}

function AppGateLoading() {
  return (
    <div className="min-h-dvh w-full bg-[var(--bg)] pl-[var(--page-pad-left)] pr-[var(--page-pad-right)] pt-[var(--page-pad-y)]">
      <ViewSkeleton />
    </div>
  );
}

export function AppShell({ children: _children }: { children: React.ReactNode }) {
  void _children;
  const pathname = usePathname();
  const [section, setSection] = useState<AppSection>(() =>
    normalizeSection(pathname),
  );
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [hasPinLock, setHasPinLock] = useState(false);
  const [hasNativeSession, setHasNativeSession] = useState(false);
  const authEnabled = isAuthEnabled();
  const { data: session, status: sessionStatus } = useSession();

  const navigateToSection = useCallback((href: string) => {
    const nextSection = normalizeSection(href);
    setSection((current) => (current === nextSection ? current : nextSection));
    if (typeof window !== "undefined" && window.location.pathname !== nextSection) {
      window.history.pushState(null, "", nextSection);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function refreshNativeSession() {
      const hasToken = await hasNativeAuthToken();
      if (!isCancelled) setHasNativeSession(hasToken);
    }
    void refreshNativeSession();
    function onNativeAuthChanged() {
      void refreshNativeSession();
    }
    window.addEventListener(NATIVE_AUTH_CHANGED_EVENT, onNativeAuthChanged);
    return () => {
      isCancelled = true;
      window.removeEventListener(NATIVE_AUTH_CHANGED_EVENT, onNativeAuthChanged);
    };
  }, []);

  useEffect(() => {
    try {
      clearChunkReloadFlag();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setSection(normalizeSection(pathname));
    if (
      typeof window !== "undefined" &&
      (pathname === "/semanas" || pathname.startsWith("/semanas/"))
    ) {
      window.history.replaceState(null, "", "/");
    }
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => {
      setSection(normalizeSection(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navValue = useMemo(
    () => ({ section, navigateToSection }),
    [section, navigateToSection],
  );

  const hydrated = useFinanceStore((s) => s.hydrated);
  const profile = useFinanceStore((s) => s.profile);
  const isFormOpen = useFinanceStore((s) => s.isFormOpen);
  const openForm = useFinanceStore((s) => s.openForm);
  const closeForm = useFinanceStore((s) => s.closeForm);

  useEffect(() => {
    if (!hydrated) return;
    const enabled = isPinEnabled();
    setHasPinLock(enabled);
    if (!enabled) setIsPinUnlocked(true);
  }, [hydrated, profile.isSetupComplete]);

  useEffect(() => {
    if (!isFormOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeForm();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFormOpen, closeForm]);

  // Soft Android back: history entry while form is open.
  useEffect(
    () => bindOverlayHistoryBack(isFormOpen, closeForm),
    [isFormOpen, closeForm],
  );

  // Capacitor hardware backButton (K2): form → home → exit.
  const sectionRef = useRef(section);
  const isFormOpenRef = useRef(isFormOpen);
  sectionRef.current = section;
  isFormOpenRef.current = isFormOpen;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void bindNativeBackButton({
      isFormOpen: () => isFormOpenRef.current,
      closeForm,
      getSection: () => sectionRef.current,
      navigateHome: () => navigateToSection("/"),
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      unsubscribe?.();
    };
  }, [closeForm, navigateToSection]);

  // Deep links + local-notification taps (K6 / E3).
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void bindDeepLinkListeners((action) => {
      if (action.type === "open-form") {
        openForm(action.formType);
      }
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      unsubscribe?.();
    };
  }, [openForm]);

  // Hide splash once the gate is past loading (K3).
  useEffect(() => {
    if (!hydrated) return;
    if (authEnabled && sessionStatus === "loading" && !hasNativeSession) return;
    void hideNativeSplash();
  }, [hydrated, authEnabled, sessionStatus, hasNativeSession]);

  // Auto sync: immediately on login (with retries) + idle debounce after edits.
  useEffect(() => {
    if (!authEnabled || !hydrated) {
      stopAutoSync();
      return;
    }
    const isAuthenticated =
      sessionStatus === "authenticated" || hasNativeSession;
    if (!isAuthenticated) {
      stopAutoSync();
      return;
    }
    const sessionKey =
      session?.user?.id ?? session?.user?.email ?? "authenticated";
    startAutoSync(sessionKey);
    return () => {
      stopAutoSync();
    };
  }, [
    authEnabled,
    hydrated,
    sessionStatus,
    hasNativeSession,
    session?.user?.id,
    session?.user?.email,
  ]);

  if (!hydrated) {
    return <AppGateLoading />;
  }

  // Cloud auth first when enabled — never show onboarding before register/login.
  if (authEnabled) {
    if (sessionStatus === "loading" && !hasNativeSession) {
      return <AppGateLoading />;
    }
    if (sessionStatus === "unauthenticated" && !hasNativeSession) {
      return <AuthScreen />;
    }
  }

  if (needsProfileSetup(profile)) {
    return <OnboardingScreen />;
  }

  if (hasPinLock && !isPinUnlocked) {
    return (
      <PinUnlockScreen
        onUnlocked={() => {
          setIsPinUnlocked(true);
        }}
      />
    );
  }

  const paydayLabel = WEEKDAY_LABELS[profile.paydayWeekday] ?? profile.paydayWeekday;
  const isConfig = section === "/configuracion";

  return (
    <CurrencyProvider currency={profile.defaultCurrency}>
    <SectionNavContext.Provider value={navValue}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--card)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-[var(--ink)] focus:shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-[var(--select)]"
      >
        Ir al contenido
      </a>
      <div className="app-shell relative mx-auto grid h-dvh w-full max-w-[var(--shell-max)] grid-cols-1 overflow-hidden min-[880px]:grid-cols-[var(--sidebar-w)_1fr]">
        <aside className="hidden h-dvh min-h-0 flex-col border-r border-[var(--line)] bg-[var(--sidebar-bg)] min-[880px]:flex">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
            <SectionNavButton
              href="/"
              className={`group flex shrink-0 items-center gap-3 rounded-xl px-2 py-1.5 transition-soft hover:bg-[var(--paper-deep)] ${FOCUS_RING}`}
              ariaLabel="OpenBalance — inicio"
              onNavigate={navigateToSection}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--ink)] shadow-[var(--shadow-nav)] transition-soft group-hover:scale-[1.03] group-active:scale-95">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink-contrast)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-[18px] w-[18px]"
                  aria-hidden
                >
                  <path d="M4 18 L9 11 L13 14 L20 5" />
                  <path d="M15 5 h5 v5" />
                </svg>
              </span>
              <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                OpenBalance
              </span>
            </SectionNavButton>

            <nav className="flex min-h-0 flex-1 flex-col gap-1" aria-label="Principal">
              {MAIN_NAV_ITEMS.map((item) => {
                const active = isActivePath(section, item.href);
                return (
                  <SectionNavButton
                    key={item.href}
                    href={item.href}
                    onNavigate={navigateToSection}
                    isCurrent={active}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-soft ${FOCUS_RING} ${
                      active
                        ? "is-selected font-semibold"
                        : "text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] active:bg-[var(--paper-deep)]"
                    }`}
                  >
                    <span className="h-5 w-5 shrink-0 opacity-90 [&_svg]:h-full [&_svg]:w-full">
                      {item.icon}
                    </span>
                    {item.label}
                  </SectionNavButton>
                );
              })}
            </nav>

            <div className="mt-auto flex shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <SyncStatusChip />
                <ThemeToggle />
              </div>
              <SectionNavButton
                href="/configuracion"
                onNavigate={navigateToSection}
                isCurrent={isConfig}
                className={`flex min-h-14 items-center gap-3 rounded-xl border bg-[var(--card)] p-3 transition-soft ${FOCUS_RING} hover:shadow-[var(--shadow-nav)] ${
                  isConfig
                    ? "is-selected"
                    : "border-[var(--line)] hover:border-[var(--line-strong)]"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-[13px] font-bold text-[var(--gold)]">
                  {profile.initials}
                </span>
                <div className="min-w-0 leading-[1.35]">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
                    {profile.name}
                  </p>
                  <p className="truncate text-[12px] text-[var(--ink-soft)]">
                    Cobro semanal · {paydayLabel}
                  </p>
                </div>
              </SectionNavButton>
            </div>
          </div>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden pb-[var(--nav-h)] min-[880px]:pb-0">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--sidebar-bg)] pl-[var(--page-pad-left)] pr-[var(--page-pad-right)] py-2.5 pt-[max(0.625rem,var(--safe-top))] min-[880px]:hidden">
            <SectionNavButton
              href="/"
              className={`flex min-h-11 items-center gap-2 rounded-lg px-1 transition-soft ${FOCUS_RING}`}
              ariaLabel="OpenBalance — inicio"
              onNavigate={navigateToSection}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink-contrast)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M4 18 L9 11 L13 14 L20 5" />
                  <path d="M15 5 h5 v5" />
                </svg>
              </span>
              <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                OpenBalance
              </span>
            </SectionNavButton>
            <div className="flex items-center gap-2">
              <SyncStatusChip compact />
              <ThemeToggle compact />
              <SectionNavButton
                href="/configuracion"
                onNavigate={navigateToSection}
                ariaLabel={`Perfil de ${profile.name}`}
                isCurrent={isConfig}
                className={`flex h-11 w-11 items-center justify-center rounded-full border bg-[var(--gold-soft)] text-[12px] font-bold text-[var(--gold)] transition-soft ${FOCUS_RING} ${
                  isConfig
                    ? "border-[var(--select)] ring-2 ring-[var(--select-soft)]"
                    : "border-[var(--line)] hover:border-[var(--line-strong)]"
                }`}
              >
                {profile.initials}
              </SectionNavButton>
            </div>
          </header>

          <main
            id="main-content"
            className="section-main flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pl-[var(--page-pad-left)] pr-[var(--page-pad-right)] pt-[var(--page-pad-y)] pb-[calc(var(--fab-clearance)+8px)] min-[880px]:pl-10 min-[880px]:pr-10 min-[880px]:pt-8 min-[880px]:pb-10"
          >
            <PaydayLoadBanner />
            <div key={section} className="section-enter">
              {renderActiveSection(section)}
            </div>
          </main>
        </div>

        <nav
          className={`mobile-dock fixed inset-x-0 bottom-0 z-40 min-[880px]:hidden ${
            isFormOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
          aria-label="Móvil"
          aria-hidden={isFormOpen}
        >
          <div className="mobile-dock__bar mx-auto flex max-w-[var(--shell-max)] justify-around gap-1 border-t border-[var(--line)] bg-[var(--card)] pt-1.5 shadow-[0_-8px_24px_rgba(31,29,32,0.08)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
            {MAIN_NAV_ITEMS.map((item) => {
              const active = isActivePath(section, item.href);
              return (
                <SectionNavButton
                  key={item.href}
                  href={item.href}
                  onNavigate={navigateToSection}
                  isCurrent={active}
                  className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold leading-tight transition-soft ${FOCUS_RING} active:scale-95 ${
                    active
                      ? "text-[var(--select-fg)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition-soft [&_svg]:h-[18px] [&_svg]:w-[18px] ${
                      active
                        ? "bg-[var(--select-soft)] shadow-[inset_0_0_0_1.5px_var(--select-border)]"
                        : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="max-w-full truncate">{item.short}</span>
                </SectionNavButton>
              );
            })}
          </div>
        </nav>

        {!isFormOpen ? (
          <button
            type="button"
            onClick={() => {
              void hapticLightImpact();
              openForm();
            }}
            aria-label="Nueva transacción"
            className="fab-button absolute z-50 flex h-[var(--fab-size)] w-[var(--fab-size)] items-center justify-center rounded-full bg-[var(--select)] text-[26px] leading-none text-[var(--chip-active-text)] shadow-[var(--shadow-fab)] transition-soft hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] active:scale-95 max-[879px]:bottom-[calc(var(--nav-h)+16px)] min-[880px]:bottom-8"
          >
            <span aria-hidden className="mb-0.5">
              +
            </span>
          </button>
        ) : null}

        {isFormOpen ? <TransactionForm /> : null}
        <AppToast />
      </div>
    </SectionNavContext.Provider>
    </CurrencyProvider>
  );
}
