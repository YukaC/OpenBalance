import { parseMoneyInput, roundAmountForCurrency } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import type { LoadOrigin, PaymentMethod, TransactionType } from "@/lib/types";

export type PdfDraftTransaction = {
  type: TransactionType;
  amount: number;
  date: string;
  method: PaymentMethod;
  title: string;
  note: string;
  currency: CurrencyCode;
  origin: LoadOrigin;
  /** Raw line used for the match (debug / preview). */
  sourceLine: string;
};

const DATE_PATTERNS: RegExp[] = [
  // 15/03/2026 or 15-03-2026
  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
  // 15/03/26 or 15-03-26
  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/,
  // 2026-03-15
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
];

// Amount at end of line: optional sign/currency, AR/US grouping.
const AMOUNT_AT_END =
  /([-+]?)\s*(?:ARS|USD|U\$S|US\$|\$)?\s*((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:ARS|USD|U\$S|US\$|\$)?\s*$/i;

const NOISE_LINE =
  /^(página|page|total|saldo|resumen|periodo|período|titular|tarjeta|vencimiento|pago\s+mínimo|cbu|cuit|iva|interest|balance)/i;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2100) return null;
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return iso;
}

function parseFlexibleDate(rawLine: string): { date: string; rest: string } | null {
  for (const pattern of DATE_PATTERNS) {
    const match = rawLine.match(pattern);
    if (!match || match.index == null) continue;

    let year: number;
    let month: number;
    let day: number;

    if (match[0].includes("-") && match[1].length === 4) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      day = Number(match[1]);
      month = Number(match[2]);
      const rawYear = Number(match[3]);
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    }

    const date = toIsoDate(year, month, day);
    if (!date) continue;

    const rest = `${rawLine.slice(0, match.index)} ${rawLine.slice(match.index + match[0].length)}`
      .replace(/\s+/g, " ")
      .trim();
    return { date, rest };
  }
  return null;
}

function parseAmountToken(raw: string): number {
  return parseMoneyInput(raw.replace(/[^\d.,+-]/g, ""));
}

/**
 * Extract plain-text lines from a PDF ArrayBuffer (browser / pdfjs-dist).
 */
export async function extractPdfTextLines(
  data: ArrayBuffer,
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // Served from /public (copied on postinstall) so CSP worker-src 'self' works.
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = String(item.str ?? "").trim();
      if (!text) continue;

      const transform = "transform" in item ? item.transform : null;
      const y =
        Array.isArray(transform) && typeof transform[5] === "number"
          ? transform[5]
          : null;

      if (lastY != null && y != null && Math.abs(lastY - y) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = text;
      } else {
        currentLine = currentLine ? `${currentLine} ${text}` : text;
      }
      if (y != null) lastY = y;
    }

    if (currentLine.trim()) lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * Heuristic parse of AR bank / credit-card statement text lines
 * into draft transactions (usually gastos).
 */
export function parseStatementLines(
  lines: string[],
  defaultCurrency: CurrencyCode = "ARS",
): { drafts: PdfDraftTransaction[]; skippedCount: number } {
  const drafts: PdfDraftTransaction[] = [];
  let skippedCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.length < 8) {
      skippedCount += 1;
      continue;
    }
    if (NOISE_LINE.test(line)) {
      skippedCount += 1;
      continue;
    }

    const dated = parseFlexibleDate(line);
    if (!dated) {
      skippedCount += 1;
      continue;
    }

    const amountMatch = dated.rest.match(AMOUNT_AT_END);
    if (!amountMatch) {
      skippedCount += 1;
      continue;
    }

    const amount = Math.abs(parseAmountToken(amountMatch[2]));
    if (!Number.isFinite(amount) || amount <= 0) {
      skippedCount += 1;
      continue;
    }

    let title = dated.rest
      .slice(0, amountMatch.index ?? dated.rest.length)
      .replace(/[$€]/g, "")
      .replace(/\b(ARS|USD|U\$S|US\$)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    title = title.replace(/\s+/g, " ").trim();
    if (!title || title.length < 2) {
      skippedCount += 1;
      continue;
    }

    // Credits / refunds: CR marker, leading +, or explicit negative as payment.
    const isCredit =
      /\b(cr|credito|crédito|devoluci[oó]n|refund|pago\s+recibido)\b/i.test(
        line,
      ) ||
      amountMatch[1] === "+" ||
      amountMatch[1] === "-";

    drafts.push({
      type: isCredit ? "ingreso" : "gasto",
      amount: roundAmountForCurrency(amount, defaultCurrency),
      date: dated.date,
      method: "tarjeta_credito",
      title: title.slice(0, 120),
      note: "Importado desde PDF",
      currency: defaultCurrency,
      origin: "importado",
      sourceLine: line,
    });
  }

  return { drafts, skippedCount };
}

/**
 * Full pipeline: PDF bytes → draft transactions.
 */
export async function parsePdfStatement(
  data: ArrayBuffer,
  defaultCurrency: CurrencyCode = "ARS",
): Promise<{ drafts: PdfDraftTransaction[]; skippedCount: number; lineCount: number }> {
  const lines = await extractPdfTextLines(data);
  const { drafts, skippedCount } = parseStatementLines(lines, defaultCurrency);
  return { drafts, skippedCount, lineCount: lines.length };
}
