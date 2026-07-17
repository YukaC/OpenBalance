"use client";

import { useRef, useState } from "react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { FOCUS_RING } from "@/lib/focus-ring";
import { formatMoney } from "@/lib/format";
import {
  parsePdfStatement,
  type PdfDraftTransaction,
} from "@/lib/pdf-statement";
import { isActive } from "@/lib/entity-lifecycle";
import { useFinanceStore } from "@/store/finance-store";

export function ImportPdfSection() {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const defaultCurrency = useFinanceStore((s) => s.profile.defaultCurrency);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const [drafts, setDrafts] = useState<PdfDraftTransaction[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handlePdfSelected(file: File | undefined) {
    if (!file) return;
    setStatusMessage(null);
    setDrafts([]);
    setSelectedIndexes(new Set());
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const { drafts: parsed, skippedCount, lineCount } =
        await parsePdfStatement(buffer, defaultCurrency);
      setDrafts(parsed);
      setSelectedIndexes(new Set(parsed.map((_, index) => index)));
      if (parsed.length === 0) {
        setStatusMessage(
          `No se detectaron movimientos (${lineCount} líneas, ${skippedCount} omitidas). Probá otro PDF o exportá CSV.`,
        );
      } else {
        setStatusMessage(
          `Se detectaron ${parsed.length} movimientos (${skippedCount} líneas omitidas). Revisá y confirmá.`,
        );
      }
    } catch {
      setStatusMessage("No se pudo leer el PDF.");
    } finally {
      setIsParsing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  function toggleDraft(index: number) {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAllDrafts(shouldSelect: boolean) {
    setSelectedIndexes(
      shouldSelect ? new Set(drafts.map((_, index) => index)) : new Set(),
    );
  }

  function handleConfirmImport() {
    if (selectedIndexes.size === 0) return;
    setIsImporting(true);
    try {
      const existingKeys = new Set(
        transactions.filter(isActive).map(
          (tx) => `${tx.date}|${tx.amount}|${tx.title.trim().toLowerCase()}`,
        ),
      );
      let importedCount = 0;
      let duplicateCount = 0;

      for (const index of selectedIndexes) {
        const draft = drafts[index];
        if (!draft) continue;
        const key = `${draft.date}|${draft.amount}|${draft.title.trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          duplicateCount += 1;
          continue;
        }
        addTransaction({
          type: draft.type,
          amount: draft.amount,
          date: draft.date,
          method: draft.method,
          categoryId: null,
          incomeSourceId: null,
          note: draft.note,
          title: draft.title,
          currency: draft.currency,
          origin: draft.origin,
        });
        existingKeys.add(key);
        importedCount += 1;
      }

      const parts = [`Se importaron ${importedCount} movimientos desde PDF.`];
      if (duplicateCount > 0) {
        parts.push(`Se omitieron ${duplicateCount} duplicados.`);
      }
      setStatusMessage(parts.join(" "));
      setDrafts([]);
      setSelectedIndexes(new Set());
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <CollapsibleLedgerSection
      headingId="import-pdf-heading"
      title="Importar PDF"
      lede="Resumen de tarjeta (texto extraído). Revisá el borrador antes de confirmar."
    >
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handlePdfSelected(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={isParsing}
        onClick={() => pdfInputRef.current?.click()}
        className={`flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isParsing ? "Leyendo PDF…" : "Subir resumen PDF"}
      </button>

      {statusMessage ? (
        <p className="text-[13px] text-[var(--ink-soft)]" role="status">
          {statusMessage}
        </p>
      ) : null}

      {drafts.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Borrador ({selectedIndexes.size}/{drafts.length})
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectAllDrafts(true)}
                className={`text-[12.5px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] ${FOCUS_RING}`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => selectAllDrafts(false)}
                className={`text-[12.5px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] ${FOCUS_RING}`}
              >
                Ninguno
              </button>
            </div>
          </div>

          <div
            className="max-h-72 overflow-auto rounded-xl border border-[var(--line)]"
            role="table"
            aria-label="Borrador de movimientos del PDF"
          >
            <div
              className="grid grid-cols-[auto_5.5rem_1fr_5.5rem] gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]"
              role="row"
            >
              <span className="sr-only">Incluir</span>
              <span>Fecha</span>
              <span>Descripción</span>
              <span className="text-right">Monto</span>
            </div>
            {drafts.map((draft, index) => {
              const isSelected = selectedIndexes.has(index);
              return (
                <label
                  key={`${draft.date}-${draft.title}-${index}`}
                  className="grid cursor-pointer grid-cols-[auto_5.5rem_1fr_5.5rem] items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-[13px] last:border-b-0 hover:bg-[var(--paper-deep)]"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleDraft(index)}
                    aria-label={`Incluir ${draft.title}`}
                    className="h-4 w-4 accent-[var(--select)]"
                  />
                  <span className="font-mono text-[12px] text-[var(--ink-soft)]">
                    {draft.date}
                  </span>
                  <span className="min-w-0 truncate text-[var(--ink)]">
                    {draft.title}
                  </span>
                  <span
                    className={`text-right font-semibold tabular-nums ${
                      draft.type === "ingreso"
                        ? "text-[var(--green)]"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {draft.type === "ingreso" ? "+" : "−"}
                    {formatMoney(draft.amount, false, draft.currency)}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            disabled={isImporting || selectedIndexes.size === 0}
            onClick={handleConfirmImport}
            className={`flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:opacity-90 disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isImporting
              ? "Importando…"
              : `Confirmar importación (${selectedIndexes.size})`}
          </button>
        </div>
      ) : null}
    </CollapsibleLedgerSection>
  );
}
