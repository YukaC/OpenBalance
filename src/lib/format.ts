import type { Weekday } from "./types";

export type CurrencyCode = "ARS" | "USD";

/**
 * Normalize an amount for storage by currency:
 * ARS → whole pesos; USD → two decimal places (cents).
 */
export function roundAmountForCurrency(
  amount: number,
  currency: CurrencyCode,
): number {
  if (currency === "USD") {
    return Math.round(amount * 100) / 100;
  }
  return Math.round(amount);
}

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  ARS: "es-AR",
  USD: "en-US",
};

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  ARS: "$",
  USD: "US$",
};

export function formatMoney(
  amount: number,
  withSign = false,
  currency: CurrencyCode = "ARS",
): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString(CURRENCY_LOCALE[currency], {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  const symbol = CURRENCY_SYMBOL[currency];
  if (!withSign) return `${symbol}${formatted}`;
  if (amount > 0) return `+${symbol}${formatted}`;
  if (amount < 0) return `−${symbol}${formatted}`;
  return `${symbol}${formatted}`;
}

/**
 * Parse user-typed money for ARS-first UX.
 * Supports `270.000`, `1.080.000`, `49.656,39`, `49656,39`, and plain `270000`.
 * Returns NaN when the value is not a finite positive/zero number.
 */
export function parseMoneyInput(raw: string): number {
  let normalized = raw.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!normalized) return Number.NaN;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Last separator is the decimal mark.
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      // es-AR: 1.234.567,89
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // en-US: 1,234,567.89
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = normalized.split(",");
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      // Decimal comma: 49656,39
      normalized = `${parts[0]}.${parts[1]}`;
    } else {
      // Thousand commas: 1,080,000
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = normalized.split(".");
    const isThousandGrouped =
      parts.length > 1 &&
      parts.every((part, index) =>
        index === 0 ? /^\d+$/.test(part) : /^\d{3}$/.test(part),
      );
    if (isThousandGrouped) {
      // es-AR thousands: 270.000 / 1.080.000
      normalized = parts.join("");
    }
    // else keep as decimal: 49.5 / 49.56
  }

  // Drop leftover currency junk, keep digits / sign / decimal point.
  normalized = normalized.replace(/[^\d.-]/g, "");
  if (!normalized || !/\d/.test(normalized)) return Number.NaN;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

export const CURRENCY_OPTIONS: Array<{
  value: CurrencyCode;
  label: string;
  shortLabel: string;
}> = [
  { value: "ARS", label: "ARS · pesos argentinos", shortLabel: "ARS" },
  { value: "USD", label: "USD · dólares", shortLabel: "USD" },
];


export function formatPercentDelta(
  current: number,
  previous: number,
  previousMonthName?: string,
): {
  label: string;
  direction: "up" | "down" | "flat";
} {
  const vsLabel = previousMonthName
    ? `vs. ${previousMonthName}`
    : "vs. mes anterior";

  if (previous === 0) {
    if (current === 0) return { label: "Sin cambio", direction: "flat" };
    return { label: "Nuevo mes", direction: "up" };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(Math.abs(delta));
  if (Math.abs(delta) < 0.5) return { label: "Sin cambio", direction: "flat" };
  if (delta > 0) return { label: `${rounded}% ${vsLabel}`, direction: "up" };
  return { label: `${rounded}% ${vsLabel}`, direction: "down" };
}

export const METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  otro: "Otro",
};

export const WEEKDAYS: Weekday[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

/** Capitalized singular labels for UI pickers (e.g. onboarding). */
export const WEEKDAY_FULL: Record<Weekday, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

/** Lowercase labels used in prose (plural weekends). */
export const WEEKDAY_FULL_LABELS: Record<Weekday, string> = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábados",
  domingo: "domingos",
};

