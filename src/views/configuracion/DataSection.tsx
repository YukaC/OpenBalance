import type { RefObject } from "react";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";

type DataSectionProps = {
  csvInputRef: RefObject<HTMLInputElement | null>;
  backupInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string | null;
  onExportCsv: () => void;
  onImportCsv: (file: File | undefined) => void;
  onExportBackup: () => void;
  onRestoreBackup: (file: File | undefined) => void;
  onReset: () => void;
};

export function DataSection({
  csvInputRef,
  backupInputRef,
  importMessage,
  onExportCsv,
  onImportCsv,
  onExportBackup,
  onRestoreBackup,
  onReset,
}: DataSectionProps) {
  return (
    <CollapsibleLedgerSection headingId="data-heading" title="Datos">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onImportCsv(e.target.files?.[0])}
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onRestoreBackup(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={onExportCsv}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
      >
        Exportar CSV
      </button>
      <button
        type="button"
        onClick={() => csvInputRef.current?.click()}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
      >
        Importar CSV
      </button>
      <button
        type="button"
        onClick={onExportBackup}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:opacity-90"
      >
        Exportar respaldo
      </button>
      <button
        type="button"
        onClick={() => backupInputRef.current?.click()}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
      >
        Restaurar respaldo
      </button>
      {importMessage ? (
        <p className="text-[13px] text-[var(--ink-soft)]" role="status">
          {importMessage}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onReset}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] text-[14px] font-bold text-[var(--red)] transition-colors hover:bg-[var(--red-soft)]"
      >
        Restablecer datos demo
      </button>
      <p className="text-[12px] leading-relaxed text-[var(--ink-soft)]">
        Restaura el perfil demo (Mariano J.) con <code>isSetupComplete</code> en
        true, categorías y movimientos de julio 2026. No vuelve a mostrar el
        onboarding.
      </p>
    </CollapsibleLedgerSection>
  );
}
