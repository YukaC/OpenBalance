"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WEEKDAY_LABELS } from "@/lib/format";
import { useFinanceStore } from "@/store/finance-store";
import { TransactionForm } from "@/components/TransactionForm";

const NAV_ITEMS = [
  { href: "/", label: "Resumen", short: "Resumen" },
  { href: "/semanas", label: "Semanas", short: "Semanas" },
  { href: "/transacciones", label: "Movimientos", short: "Movs." },
  { href: "/categorias", label: "Categorías", short: "Categ." },
  { href: "/configuracion", label: "Perfil", short: "Perfil" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useFinanceStore((s) => s.profile);
  const isFormOpen = useFinanceStore((s) => s.isFormOpen);
  const openForm = useFinanceStore((s) => s.openForm);

  const paydayLabel = WEEKDAY_LABELS[profile.paydayWeekday] ?? profile.paydayWeekday;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[var(--shell-max)] flex-col px-4 pb-[calc(var(--nav-h)+28px)] pt-5 sm:max-w-3xl sm:px-6 sm:pb-10">
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <Link href="/" className="group">
            <p className="font-display text-[2rem] leading-none tracking-[-0.03em] text-[var(--ink)] sm:text-[2.25rem]">
              Rinde
            </p>
          </Link>

          <div className="flex items-center gap-2.5 rounded-[var(--radius-full)] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 shadow-[0_1px_0_rgba(20,20,20,0.03)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] font-medium tracking-wide text-[var(--chip-active-text)]">
              {profile.initials}
            </span>
            <div className="min-w-0 pr-1">
              <p className="truncate text-[13px] font-medium text-[var(--ink)]">
                {profile.name}
              </p>
              <p className="truncate text-[11px] text-[var(--ink-muted)]">
                Cobro semanal · {paydayLabel}.
              </p>
            </div>
          </div>
        </div>

        <nav
          className="hidden items-center gap-1 border-b border-[var(--line)] sm:flex"
          aria-label="Principal"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2.5 text-[13.5px] transition-colors ${
                  active
                    ? "font-medium text-[var(--ink)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 bg-[var(--ink)]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_92%,white)] backdrop-blur-md sm:hidden"
        aria-label="Móvil"
      >
        <ul className="mx-auto flex max-w-[var(--shell-max)] items-stretch justify-between px-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex h-[var(--nav-h)] flex-col items-center justify-center gap-0.5 text-[11px] ${
                    active
                      ? "font-medium text-[var(--ink)]"
                      : "text-[var(--ink-faint)]"
                  }`}
                >
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => openForm()}
        aria-label="Nueva transacción"
        className="fixed bottom-[calc(var(--nav-h)+16px)] right-[max(1rem,calc(50%-var(--shell-max)/2+1rem))] z-50 flex h-[var(--fab-size)] w-[var(--fab-size)] items-center justify-center rounded-full bg-[var(--ink)] text-[1.75rem] leading-none text-[var(--chip-active-text)] shadow-[0_8px_24px_rgba(20,20,20,0.18)] transition-transform active:scale-95 sm:bottom-8 sm:right-[max(1.5rem,calc(50%-24rem+1.5rem))]"
      >
        <span aria-hidden className="mb-0.5">
          +
        </span>
      </button>

      {isFormOpen ? <TransactionForm /> : null}
    </div>
  );
}
