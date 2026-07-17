import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";

type PinSectionProps = {
  pinEnabled: boolean;
  currentPin: string;
  setCurrentPin: (value: string) => void;
  newPin: string;
  setNewPin: (value: string) => void;
  confirmPin: string;
  setConfirmPin: (value: string) => void;
  pinError: string;
  pinMessage: string;
  isSavingPin: boolean;
  onSavePin: () => void;
  onDisablePin: () => void;
  /** S4 — only meaningful on Capacitor when hardware is available. */
  canUseBiometric?: boolean;
  biometricEnabled?: boolean;
  isTogglingBiometric?: boolean;
  onToggleBiometric?: (enabled: boolean) => void;
};

export function PinSection({
  pinEnabled,
  currentPin,
  setCurrentPin,
  newPin,
  setNewPin,
  confirmPin,
  setConfirmPin,
  pinError,
  pinMessage,
  isSavingPin,
  onSavePin,
  onDisablePin,
  canUseBiometric = false,
  biometricEnabled = false,
  isTogglingBiometric = false,
  onToggleBiometric,
}: PinSectionProps) {
  return (
    <CollapsibleLedgerSection
      headingId="pin-heading"
      title="PIN local"
      lede={
        <>
          <p className="section-lede">
            Opcional. Se guarda hasheado en este dispositivo (no hay recuperación
            remota).
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--ink-faint)]">
            Cifra el almacenamiento local; el PIN nunca se envía al servidor.
          </p>
        </>
      }
    >
      <p className="text-center text-[13px] font-medium text-[var(--ink)]">
        Estado: {pinEnabled ? "activado" : "desactivado"}
      </p>

      {pinEnabled ? (
        <label htmlFor="current-pin" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            PIN actual
          </span>
          <input
            id="current-pin"
            name="currentPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={currentPin}
            onChange={(e) =>
              setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>
      ) : null}

      <label htmlFor="new-pin" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          {pinEnabled ? "Nuevo PIN" : "PIN (4–6 dígitos)"}
        </span>
        <input
          id="new-pin"
          name="newPin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={newPin}
          onChange={(e) =>
            setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
        />
      </label>

      <label htmlFor="confirm-pin" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          Confirmar PIN
        </span>
        <input
          id="confirm-pin"
          name="confirmPin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={confirmPin}
          onChange={(e) =>
            setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
        />
      </label>

      {pinError ? (
        <p className="text-[13px] text-[var(--red)]" role="alert">
          {pinError}
        </p>
      ) : null}
      {pinMessage ? (
        <p className="text-[13px] text-[var(--ink-soft)]" role="status">
          {pinMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isSavingPin}
          onClick={() => void onSavePin()}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
        >
          {pinEnabled ? "Cambiar PIN" : "Activar PIN"}
        </button>
        {pinEnabled ? (
          <button
            type="button"
            onClick={() => void onDisablePin()}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--line)] text-[14px] font-bold text-[var(--red)] transition-colors hover:bg-[var(--red-soft)]"
          >
            Desactivar PIN
          </button>
        ) : null}
      </div>

      {pinEnabled && canUseBiometric && onToggleBiometric ? (
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--ink)]"
            checked={biometricEnabled}
            disabled={isTogglingBiometric}
            onChange={(event) => {
              void onToggleBiometric(event.target.checked);
            }}
          />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-[var(--ink)]">
              Desbloquear con huella / Face ID
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[var(--ink-soft)]">
              Pedimos el PIN una vez al activarlo; después podés abrir la app con
              biometría. El cifrado sigue basado en el PIN.
            </span>
          </span>
        </label>
      ) : null}
    </CollapsibleLedgerSection>
  );
}
