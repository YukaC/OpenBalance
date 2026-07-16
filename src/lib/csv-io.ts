import { METHOD_LABELS, parseMoneyInput } from "@/lib/format";
import type {
  Category,
  IncomeSource,
  LoadOrigin,
  PaymentMethod,
  TransactionType,
} from "@/lib/types";

const METHOD_FROM_LABEL: Record<string, PaymentMethod> = Object.fromEntries(
  Object.entries(METHOD_LABELS).map(([key, label]) => [
    label.toLowerCase(),
    key as PaymentMethod,
  ]),
) as Record<string, PaymentMethod>;

export interface CsvImportRow {
  type: TransactionType;
  amount: number;
  date: string;
  method: PaymentMethod;
  categoryId: string | null;
  incomeSourceId: string | null;
  note: string;
  title: string;
  currency: "ARS" | "USD";
  origin: LoadOrigin;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseMethod(raw: string): PaymentMethod | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "otro";
  if (normalized in METHOD_LABELS) return normalized as PaymentMethod;
  return METHOD_FROM_LABEL[normalized] ?? null;
}

function parseCurrency(raw: string, fallback: "ARS" | "USD"): "ARS" | "USD" {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "USD" || normalized === "ARS") return normalized;
  return fallback;
}

/**
 * Parse CSV matching export columns:
 * fecha,tipo,titulo,monto,moneda,metodo,categoria,fuente,nota,mes,semana
 */
export function parseTransactionsCsv(
  text: string,
  categories: Category[],
  incomeSources: IncomeSource[],
  defaultCurrency: "ARS" | "USD",
): { rows: CsvImportRow[]; skippedCount: number } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], skippedCount: 0 };

  const headerCells = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = headerCells.includes("fecha") && headerCells.includes("tipo");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const categoryByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );
  const sourceByName = new Map(
    incomeSources.map((source) => [source.name.toLowerCase(), source.id]),
  );

  const rows: CsvImportRow[] = [];
  let skippedCount = 0;

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const [
      fecha = "",
      tipo = "",
      titulo = "",
      monto = "",
      moneda = "",
      metodo = "",
      categoria = "",
      fuente = "",
      nota = "",
    ] = cells;

    const type = tipo.trim().toLowerCase() as TransactionType;
    if (type !== "ingreso" && type !== "gasto") {
      skippedCount += 1;
      continue;
    }

    const date = fecha.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skippedCount += 1;
      continue;
    }

    const amount = parseMoneyInput(String(monto));
    if (!Number.isFinite(amount) || amount <= 0) {
      skippedCount += 1;
      continue;
    }

    const method = parseMethod(metodo);
    if (!method) {
      skippedCount += 1;
      continue;
    }

    const categoryId =
      type === "gasto" && categoria.trim()
        ? (categoryByName.get(categoria.trim().toLowerCase()) ?? null)
        : null;
    const incomeSourceId =
      type === "ingreso" && fuente.trim()
        ? (sourceByName.get(fuente.trim().toLowerCase()) ?? null)
        : null;

    rows.push({
      type,
      amount: Math.round(amount),
      date,
      method,
      categoryId,
      incomeSourceId,
      note: nota.trim(),
      title: titulo.trim() || (type === "ingreso" ? "Ingreso" : "Gasto"),
      currency: parseCurrency(moneda, defaultCurrency),
      origin: "importado",
    });
  }

  return { rows, skippedCount };
}
