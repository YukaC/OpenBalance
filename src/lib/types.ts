export type TransactionType = "ingreso" | "gasto";

export type PaymentMethod =
  | "transferencia"
  | "efectivo"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "otro";

export type CategoryKind = "fijo" | "variable" | "hormiga";

export type IncomeSourceType = "semanal" | "mensual" | "variable";

export type LoadOrigin = "manual" | "importado" | "recurrente";

export type Weekday =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

/** Soft-delete / sync timestamps — optional until migrate fills them. */
export interface SyncLifecycle {
  /** ISO timestamp of last local mutation. */
  updatedAt?: string;
  /** Soft-delete tombstone; null/undefined = active. */
  deletedAt?: string | null;
}

export interface UserProfile extends SyncLifecycle {
  id: string;
  name: string;
  email: string;
  defaultCurrency: "ARS" | "USD";
  paydayWeekday: Weekday;
  initials: string;
  /** False/undefined until first-run onboarding finishes. Seed demo sets true. */
  isSetupComplete?: boolean;
  defaultAccountId?: string;
  /** Remind to load income on payday (in-app + optional Web Notification). */
  shouldRemindPaydayLoad: boolean;
  /** Optional monthly savings target (same unit as defaultCurrency). */
  monthlySavingsGoal?: number | null;
}

export interface Account extends SyncLifecycle {
  id: string;
  name: string;
  currency: "ARS" | "USD";
  /** Starting ledger balance; omitted/undefined treated as 0. */
  openingBalance?: number;
}

export interface Budget extends SyncLifecycle {
  id: string;
  categoryId: string;
  month: string;
  amountLimit: number;
}

export interface IncomeSource extends SyncLifecycle {
  id: string;
  name: string;
  type: IncomeSourceType;
  isRecurring: boolean;
}

export interface Category extends SyncLifecycle {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  keywords: string[];
}

export interface Transaction extends SyncLifecycle {
  id: string;
  type: TransactionType;
  amount: number;
  currency: "ARS" | "USD";
  date: string;
  method: PaymentMethod;
  categoryId: string | null;
  incomeSourceId: string | null;
  accountId?: string | null;
  note: string;
  /**
   * ISO week of `date` (`YYYY-Www`, via `toWeekIso`). Derived at write time;
   * pay-week filtering uses date bounds from `getMonthWorkWeeks`, not this alone.
   */
  weekIso: string;
  /**
   * Calendar month of `date` (`YYYY-MM`). Recurring fixed expenses may be
   * projected onto later months via `projectTransactionToMonth`.
   */
  month: string;
  origin: LoadOrigin;
  title: string;
  isAutoCategorized: boolean;
  /**
   * Recurring monthly expense: counted in every month from its start month
   * onward until the transaction is deleted (or isFixed turned off).
   */
  isFixed: boolean;
  /**
   * For fixed expenses: which pay week of the month (1-based).
   * Typically 1 (primera) or 4 (cuarta). Placed on that week's payday.
   */
  fixedPayWeekIndex?: number | null;
  /** Links cuota transactions created together (e.g. credit-card installments). */
  installmentGroupId?: string | null;
  /** 1-based index within the installment series. */
  installmentIndex?: number | null;
  /** Total cuotas in the series. */
  installmentCount?: number | null;
  /**
   * Links the paired legs of an account transfer (gasto + ingreso).
   * Soft-delete always removes both legs together.
   */
  transferGroupId?: string | null;
}

export interface UserCategoryRule extends SyncLifecycle {
  id: string;
  pattern: string;
  categoryId: string;
}
