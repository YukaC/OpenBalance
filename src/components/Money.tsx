import { formatMoney } from "@/lib/format";

interface MoneyProps {
  amount: number;
  withSign?: boolean;
  tone?: "income" | "expense" | "neutral";
  className?: string;
}

export function Money({
  amount,
  withSign = false,
  tone = "neutral",
  className = "",
}: MoneyProps) {
  const color =
    tone === "income"
      ? "text-[var(--income)]"
      : tone === "expense"
        ? "text-[var(--expense)]"
        : "text-[var(--ink)]";

  return (
    <span className={`font-mono tabular-nums tracking-tight ${color} ${className}`}>
      {formatMoney(amount, withSign)}
    </span>
  );
}
