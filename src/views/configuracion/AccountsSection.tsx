import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { CURRENCY_OPTIONS } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import type { Account, UserProfile } from "@/lib/types";

type AccountsSectionProps = {
  profile: UserProfile;
  accounts: Account[];
  newAccountName: string;
  setNewAccountName: (value: string) => void;
  newAccountCurrency: CurrencyCode;
  setNewAccountCurrency: (value: CurrencyCode) => void;
  onAddAccount: (event: React.FormEvent) => void;
  onRemoveAccount: (accountId: string, accountName: string) => void;
  onSetDefaultAccount: (accountId: string) => void;
};

export function AccountsSection({
  profile,
  accounts,
  newAccountName,
  setNewAccountName,
  newAccountCurrency,
  setNewAccountCurrency,
  onAddAccount,
  onRemoveAccount,
  onSetDefaultAccount,
}: AccountsSectionProps) {
  return (
    <CollapsibleLedgerSection
      headingId="accounts-heading"
      title="Cuentas"
      lede="Multi-cuenta lite: cada movimiento puede asociarse a una cuenta."
    >
      <ul className="space-y-2">
        {accounts.map((account) => {
          const isDefault = profile.defaultAccountId === account.id;
          return (
            <li
              key={account.id}
              className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-b-0"
            >
              <span className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--ink)]">
                {account.name}{" "}
                <span className="font-normal text-[var(--ink-soft)]">
                  · {account.currency}
                </span>
                {isDefault ? (
                  <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                    Por defecto
                  </span>
                ) : null}
              </span>
              {!isDefault ? (
                <button
                  type="button"
                  onClick={() => onSetDefaultAccount(account.id)}
                  className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]"
                >
                  Usar por defecto
                </button>
              ) : null}
              {accounts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onRemoveAccount(account.id, account.name)}
                  className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--red)] hover:bg-[var(--red-soft)]"
                >
                  Quitar
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={onAddAccount}
        className="flex flex-wrap items-end gap-2 pt-1"
      >
        <label
          htmlFor="new-account-name"
          className="flex min-w-[10rem] flex-1 flex-col gap-1.5"
        >
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Nueva cuenta
          </span>
          <input
            id="new-account-name"
            name="accountName"
            autoComplete="off"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Ej. Dólares"
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>
        <label htmlFor="new-account-currency" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Moneda
          </span>
          <select
            id="new-account-currency"
            name="accountCurrency"
            value={newAccountCurrency}
            onChange={(e) =>
              setNewAccountCurrency(e.target.value as CurrencyCode)
            }
            className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.shortLabel}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-[var(--select)] px-4 text-[13px] font-bold text-[var(--chip-active-text)] transition-colors hover:opacity-90"
        >
          Agregar
        </button>
      </form>
    </CollapsibleLedgerSection>
  );
}
