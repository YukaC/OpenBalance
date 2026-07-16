export type CurrencyCode = "ARS" | "USD";

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
  const formatted = abs.toLocaleString(CURRENCY_LOCALE[currency]);
  const symbol = CURRENCY_SYMBOL[currency];
  if (!withSign) return `${symbol}${formatted}`;
  if (amount > 0) return `+${symbol}${formatted}`;
  if (amount < 0) return `−${symbol}${formatted}`;
  return `${symbol}${formatted}`;
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

export const WEEKDAY_LABELS: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

export const WEEKDAY_FULL_LABELS: Record<string, string> = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábados",
  domingo: "domingos",
};

