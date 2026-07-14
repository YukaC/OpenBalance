import { formatShortDate } from "@/lib/dates";
import type { Category, Transaction } from "@/lib/types";
import { Money } from "@/components/Money";

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | null;
  incomeSourceName?: string | null;
  weekLabel?: string | null;
}

export function TransactionRow({
  transaction,
  category,
  incomeSourceName,
  weekLabel,
}: TransactionRowProps) {
  const isIncome = transaction.type === "ingreso";
  const icon = isIncome ? "↓" : (category?.icon ?? "•");
  const metaParts: string[] = [];

  if (isIncome && incomeSourceName) {
    metaParts.push(incomeSourceName);
  } else if (category) {
    metaParts.push(category.name);
  }

  metaParts.push(formatShortDate(transaction.date));

  if (transaction.isAutoCategorized) metaParts.push("auto-clasificado");
  if (transaction.isFixed) metaParts.push("fijo");
  if (weekLabel) metaParts.push(weekLabel);

  return (
    <article className="flex items-start gap-3 py-3.5 border-b border-[var(--line)] last:border-b-0">
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--chip)] text-lg leading-none"
        aria-hidden
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-[var(--ink)]">
          {transaction.title}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-[var(--ink-muted)]">
          {metaParts.join(" · ")}
        </p>
      </div>

      <Money
        amount={isIncome ? transaction.amount : -transaction.amount}
        withSign
        tone={isIncome ? "income" : "expense"}
        className="shrink-0 text-[15px] font-medium"
      />
    </article>
  );
}
