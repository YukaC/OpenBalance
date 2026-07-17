import { useMemo } from "react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { Money } from "@/components/Money";
import { todayIso } from "@/lib/dates";
import { CURRENCY_OPTIONS, parseMoneyInput } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import { computeAccountBalance } from "@/lib/summaries";
import type { Account, Transaction, UserProfile } from "@/lib/types";

type AccountsSectionProps = {
  profile: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  newAccountName: string;
  setNewAccountName: (value: string) => void;
  newAccountCurrency: CurrencyCode;
  setNewAccountCurrency: (value: CurrencyCode) => void;
  onAddAccount: (event: React.FormEvent) => void;
  onRemoveAccount: (accountId: string, accountName: string) => void;
  onSetDefaultAccount: (accountId: string) => void;
  transferFromAccountId: string;
  setTransferFromAccountId: (value: string) => void;
  transferToAccountId: string;
  setTransferToAccountId: (value: string) => void;
  transferAmount: string;
  setTransferAmount: (value: string) => void;
  transferDate: string;
  setTransferDate: (value: string) => void;
  onAddTransfer: (event: React.FormEvent) => void;
};

export function AccountsSection({
  profile,
  accounts,
  transactions,
  newAccountName,
  setNewAccountName,
  newAccountCurrency,
  setNewAccountCurrency,
  onAddAccount,
  onRemoveAccount,
  onSetDefaultAccount,
  transferFromAccountId,
  setTransferFromAccountId,
  transferToAccountId,
  setTransferToAccountId,
  transferAmount,
  setTransferAmount,
  transferDate,
  setTransferDate,
  onAddTransfer,
}: AccountsSectionProps) {
  const canTransfer = accounts.length >= 2;

  const balanceByAccountId = useMemo(() => {
    const next = new Map<string, number>();
    for (const account of accounts) {
      next.set(account.id, computeAccountBalance(account, transactions));
    }
    return next;
  }, [accounts, transactions]);

  return (
    <CollapsibleLedgerSection
      headingId="accounts-heading"
      title="Cuentas"
      lede="Saldo = saldo inicial + ingresos − gastos del ledger activo."
    >
      <ul className="space-y-2">
        {accounts.map((account) => {
          const isDefault = profile.defaultAccountId === account.id;
          const balance = balanceByAccountId.get(account.id) ?? 0;
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
                <span className="mt-0.5 block text-[13px] font-normal text-[var(--ink-soft)]">
                  Saldo{" "}
                  <Money
                    amount={balance}
                    withSign
                    currency={account.currency}
                    tone={
                      balance > 0
                        ? "income"
                        : balance < 0
                          ? "expense"
                          : "neutral"
                    }
                    className="text-[13px] font-semibold"
                  />
                </span>
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

      {canTransfer ? (
        <form
          onSubmit={onAddTransfer}
          className="mt-4 space-y-2 border-t border-[var(--line)] pt-4"
        >
          <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Transferir entre cuentas
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label
              htmlFor="transfer-from"
              className="flex min-w-[8rem] flex-1 flex-col gap-1.5"
            >
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                Desde
              </span>
              <select
                id="transfer-from"
                name="transferFrom"
                value={transferFromAccountId}
                onChange={(e) => setTransferFromAccountId(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor="transfer-to"
              className="flex min-w-[8rem] flex-1 flex-col gap-1.5"
            >
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                Hacia
              </span>
              <select
                id="transfer-to"
                name="transferTo"
                value={transferToAccountId}
                onChange={(e) => setTransferToAccountId(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label
              htmlFor="transfer-amount"
              className="flex min-w-[8rem] flex-1 flex-col gap-1.5"
            >
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                Monto
              </span>
              <input
                id="transfer-amount"
                name="transferAmount"
                inputMode="decimal"
                autoComplete="off"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <label
              htmlFor="transfer-date"
              className="flex min-w-[8rem] flex-col gap-1.5"
            >
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                Fecha
              </span>
              <input
                id="transfer-date"
                name="transferDate"
                type="date"
                value={transferDate || todayIso()}
                onChange={(e) => setTransferDate(e.target.value)}
                className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <button
              type="submit"
              disabled={
                !transferFromAccountId ||
                !transferToAccountId ||
                transferFromAccountId === transferToAccountId ||
                !(parseMoneyInput(transferAmount) > 0)
              }
              className="min-h-11 rounded-xl bg-[var(--select)] px-4 text-[13px] font-bold text-[var(--chip-active-text)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Transferir
            </button>
          </div>
          <p className="text-[11.5px] text-[var(--ink-faint)]">
            No suma como ingreso ni gasto en el resumen del mes.
          </p>
        </form>
      ) : null}
    </CollapsibleLedgerSection>
  );
}
