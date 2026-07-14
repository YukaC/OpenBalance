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
  note: string;
  weekIso: string;
  month: string;
  origin: LoadOrigin;
  title: string;
  isAutoCategorized: boolean;
  isFixed: boolean;
}

export interface UserCategoryRule {
  id: string;
  pattern: string;
  categoryId: string;
}
