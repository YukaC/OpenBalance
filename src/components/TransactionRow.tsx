import { Money } from "@/components/Money";
import { sanitizeCssColor } from "@/lib/color-utils";
import { formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

interface TransactionRowProps {
  transaction: Transaction;
  category?: Category | null;
  incomeSourceName?: string | null;
  weekLabel?: string | null;
  onSelect?: () => void;
}

function iconBackground(
  isIncome: boolean,
  categoryColor?: string | null,
): string {
  if (isIncome) return "var(--green-soft)";
  if (!categoryColor) return "var(--red-soft)";
  const safeColor = sanitizeCssColor(categoryColor);
  return `color-mix(in srgb, ${safeColor} 24%, var(--card))`;
}

export function TransactionRow({
  transaction,
  category,
  incomeSourceName,
  weekLabel,
  onSelect,
}: TransactionRowProps) {
  const isIncome = transaction.type === "ingreso";
  const icon = isIncome ? "💵" : (category?.icon ?? "•");
  const metaParts: string[] = [];

  if (isIncome) {
    metaParts.push(incomeSourceName?.trim() || "Ingreso");
  } else if (category) {
    metaParts.push(category.name);
  }

  metaParts.push(formatShortDate(transaction.date));

  if (weekLabel) metaParts.push(weekLabel);
  if (transaction.isAutoCategorized) metaParts.push("detectado");
  if (
    transaction.installmentCount &&
    transaction.installmentCount > 1 &&
    transaction.installmentIndex
  ) {
    metaParts.push(
      `cuota ${transaction.installmentIndex}/${transaction.installmentCount}`,
    );
  } else if (transaction.isFixed) {
    metaParts.push("fijo mensual");
  }

  const typeOrCategoryLabel = isIncome
    ? "ingreso"
    : (category?.name ?? "gasto");
  const amountLabel = formatMoney(
    isIncome ? transaction.amount : -transaction.amount,
    true,
  );
  const accessibleName = `${transaction.title}, ${typeOrCategoryLabel}, ${amountLabel}`;

  return (
    <article
      className={`flex items-center gap-3 border-b border-[var(--line)] py-3 transition-soft last:border-b-0 hover:rounded-[10px] hover:bg-[var(--surface-raised)] hover:px-2 hover:-mx-2 ${
        onSelect ? "cursor-pointer" : ""
      }`}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? accessibleName : undefined}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[16px] leading-none transition-soft"
        style={{ background: iconBackground(isIncome, category?.color) }}
        aria-hidden
      >
        {icon}
      </div>
      {!onSelect ? (
        <span className="sr-only">{typeOrCategoryLabel}</span>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
          {transaction.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--ink-soft)]">
          {metaParts.join(" · ")}
        </p>
      </div>

      <Money
        amount={isIncome ? transaction.amount : -transaction.amount}
        withSign
        tone={isIncome ? "income" : "expense"}
        currency={transaction.currency}
        className={`shrink-0 whitespace-nowrap tabular-nums text-[14px] font-semibold ${
          isIncome ? "text-[var(--green)]" : "text-[var(--red)]"
        }`}
      />
    </article>
  );
}
