import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { WEEKDAYS, WEEKDAY_FULL, WEEKDAY_LABELS } from "@/lib/format";
import type { PayCadence, PaydayDayOfMonth, UserProfile, Weekday } from "@/lib/types";

const MONTHLY_DAY_OPTIONS: PaydayDayOfMonth[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 0,
];

type PaydaySectionProps = {
  profile: UserProfile;
  notificationPermission: NotificationPermission | "unsupported";
  onSetPayCadence: (payCadence: PayCadence) => void;
  onSetPayday: (weekday: Weekday) => void;
  onSetPaydayDayOfMonth: (dayOfMonth: PaydayDayOfMonth) => void;
  onTogglePaydayReminder: (enabled: boolean) => void;
};

function formatMonthlyPaydayLabel(dayOfMonth: PaydayDayOfMonth): string {
  if (dayOfMonth <= 0) return "el último día del mes";
  return `el día ${dayOfMonth}`;
}

export function PaydaySection({
  profile,
  notificationPermission,
  onSetPayCadence,
  onSetPayday,
  onSetPaydayDayOfMonth,
  onTogglePaydayReminder,
}: PaydaySectionProps) {
  const payCadence = profile.payCadence ?? "monthly";
  const isMonthly = payCadence === "monthly";

  return (
    <>
      <CollapsibleLedgerSection
        headingId="payday-heading"
        title="Día de cobro"
        lede={
          isMonthly
            ? "Los totales del mes siguen el calendario (1 al último día)."
            : "La semana abre el día siguiente y cierra el día de cobro."
        }
      >
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
            ¿Cómo cobrás?
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Cadencia de cobro"
          >
            {(
              [
                { value: "monthly" as const, label: "Mensual" },
                { value: "weekly" as const, label: "Semanal" },
              ] as const
            ).map((option) => {
              const active = payCadence === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSetPayCadence(option.value)}
                  aria-pressed={active}
                  className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "is-selected-solid"
                      : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {isMonthly ? (
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
              Día del mes
            </p>
            <div
              className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto"
              role="group"
              aria-label="Día de cobro del mes"
            >
              {MONTHLY_DAY_OPTIONS.map((day) => {
                const active = (profile.paydayDayOfMonth ?? 1) === day;
                const label = day <= 0 ? "Último" : String(day);
                return (
                  <button
                    key={day === 0 ? "last" : day}
                    type="button"
                    onClick={() => onSetPaydayDayOfMonth(day)}
                    title={
                      day <= 0 ? "Último día del mes" : `Día ${day}`
                    }
                    aria-pressed={active}
                    className={`min-w-9 rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      active
                        ? "is-selected-solid"
                        : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
              Cobro {formatMonthlyPaydayLabel(profile.paydayDayOfMonth ?? 1)}.
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
              Día de la semana
            </p>
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
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
              Cobro los {WEEKDAY_FULL[profile.paydayWeekday].toLowerCase()}.
            </p>
          </div>
        )}
      </CollapsibleLedgerSection>

      <CollapsibleLedgerSection
        headingId="reminders-heading"
        title="Recordatorios"
        lede="Si abrís OpenBalance el día de cobro y todavía no cargaste el ingreso, te mostramos un aviso. En la app nativa también programamos una notificación local; en el navegador pedimos permiso de Web Notifications."
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
