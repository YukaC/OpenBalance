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

export interface UserProfile {
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
}

export interface Account {
  id: string;
  name: string;
  currency: "ARS" | "USD";
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  amountLimit: number;
}

export interface IncomeSource {
  id: string;
  name: string;
  type: IncomeSourceType;
  isRecurring: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
  keywords: string[];
}

export interface Transaction {
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
  weekIso: string;
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
}

export interface UserCategoryRule {
  id: string;
  pattern: string;
  categoryId: string;
}
