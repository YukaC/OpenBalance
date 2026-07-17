/**
 * Manual ARS-per-USD conversion for Resumen equivalent totals (G4).
 * No external FX APIs — rate comes from profile.manualExchangeRate.
 */

export function convertWithManualRate(
  amount: number,
  fromCurrency: "ARS" | "USD",
  toCurrency: "ARS" | "USD",
  arsPerUsd: number,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (!(arsPerUsd > 0)) return amount;
  if (toCurrency === "ARS") return amount * arsPerUsd;
  return amount / arsPerUsd;
}

export type ManualFxSnapshot = {
  otherCurrency: "ARS" | "USD";
  otherIncome: number;
  otherExpense: number;
  otherBalance: number;
  rate: number | null;
  equivalentBalance: number | null;
};

/**
 * Build FX snapshot for the non-default currency month totals.
 * When rate is missing, still returns other-currency totals so UI can disclaimer.
 */
export function buildManualFxSnapshot(options: {
  defaultCurrency: "ARS" | "USD";
  manualExchangeRate: number | null | undefined;
  otherIncome: number;
  otherExpense: number;
}): ManualFxSnapshot | null {
  const otherCurrency: "ARS" | "USD" =
    options.defaultCurrency === "ARS" ? "USD" : "ARS";
  const otherIncome = options.otherIncome;
  const otherExpense = options.otherExpense;
  if (otherIncome === 0 && otherExpense === 0) return null;

  const otherBalance = otherIncome - otherExpense;
  const rate =
    options.manualExchangeRate != null && options.manualExchangeRate > 0
      ? options.manualExchangeRate
      : null;

  return {
    otherCurrency,
    otherIncome,
    otherExpense,
    otherBalance,
    rate,
    equivalentBalance:
      rate != null
        ? convertWithManualRate(
            otherBalance,
            otherCurrency,
            options.defaultCurrency,
            rate,
          )
        : null,
  };
}
