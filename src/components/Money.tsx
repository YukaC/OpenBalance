import { formatMoney, type CurrencyCode } from "@/lib/format";
import { useFinanceStore } from "@/store/finance-store";

interface MoneyProps {
  amount: number;
  withSign?: boolean;
  tone?: "income" | "expense" | "neutral";
  className?: string;
  useMono?: boolean;
  currency?: CurrencyCode;
}

/** True only for color utilities — ignores text-[14px], text-left, etc. */
function hasTextColorClass(className: string): boolean {
  return /(?:^|\s)text-(?:\[(?:var\(|#[0-9a-fA-F])|white\b|black\b|ink\b|income\b|expense\b|green\b|red\b|gold\b)/.test(
    className,
  );
}

export function Money({
  amount,
  withSign = false,
  tone = "neutral",
  className = "",
  useMono = true,
  currency: currencyProp,
}: MoneyProps) {
  const profileCurrency = useFinanceStore((s) => s.profile.defaultCurrency);
  const currency = currencyProp ?? profileCurrency;

  const color = hasTextColorClass(className)
    ? ""
    : tone === "income"
      ? "text-[var(--green)]"
      : tone === "expense"
        ? "text-[var(--red)]"
        : "text-[var(--ink)]";

  return (
    <span
      className={`${useMono ? "font-mono tabular-nums tracking-tight" : ""} ${color} ${className}`}
    >
      {formatMoney(amount, withSign, currency)}
    </span>
  );
}
