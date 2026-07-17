import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { WEEKDAYS, WEEKDAY_FULL, WEEKDAY_LABELS } from "@/lib/format";
import type { UserProfile, Weekday } from "@/lib/types";

type PaydaySectionProps = {
  profile: UserProfile;
  notificationPermission: NotificationPermission | "unsupported";
  onSetPayday: (weekday: Weekday) => void;
  onTogglePaydayReminder: (enabled: boolean) => void;
};

export function PaydaySection({
  profile,
  notificationPermission,
  onSetPayday,
  onTogglePaydayReminder,
}: PaydaySectionProps) {
  return (
    <>
      <CollapsibleLedgerSection
        headingId="payday-heading"
        title="Día de cobro"
        lede="La semana abre el día siguiente y cierra el día de cobro."
      >
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Día de cobro"
        >
          {WEEKDAYS.map((day) => {
            const active = profile.paydayWeekday === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSetPayday(day)}
                title={WEEKDAY_FULL[day]}
                aria-pressed={active}
                className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "is-selected-solid"
                    : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Cobro los {WEEKDAY_FULL[profile.paydayWeekday].toLowerCase()}.
        </p>
      </CollapsibleLedgerSection>

      <CollapsibleLedgerSection
        headingId="reminders-heading"
        title="Recordatorios"
        lede="Si abrís OpenBalance el día de cobro y todavía no cargaste el ingreso de la semana, te mostramos un aviso. En la app nativa también programamos una notificación local; en el navegador pedimos permiso de Web Notifications."
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--ink)]"
            checked={Boolean(profile.shouldRemindPaydayLoad)}
            onChange={(event) => {
              void onTogglePaydayReminder(event.target.checked);
            }}
          />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-[var(--ink)]">
              Recordarme cargar el día de cobro
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[var(--ink-soft)]">
              {notificationPermission === "granted"
                ? "Notificaciones activas (web o nativas)."
                : notificationPermission === "denied"
                  ? "Permiso denegado; el aviso en la app sigue disponible."
                  : "Al activarlo podemos pedir permiso de notificación."}
            </span>
          </span>
        </label>
      </CollapsibleLedgerSection>
    </>
  );
}
