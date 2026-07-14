export function formatMoney(amount: number, withSign = false): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString("es-AR");
  if (!withSign) return `$${formatted}`;
  if (amount > 0) return `+$${formatted}`;
  if (amount < 0) return `−$${formatted}`;
  return `$${formatted}`;
}

export function formatPercentDelta(current: number, previous: number): {
  label: string;
  direction: "up" | "down" | "flat";
} {
  if (previous === 0) {
    if (current === 0) return { label: "Sin cambio", direction: "flat" };
    return { label: "Nuevo mes", direction: "up" };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(Math.abs(delta));
  if (Math.abs(delta) < 0.5) return { label: "Sin cambio", direction: "flat" };
  if (delta > 0) return { label: `▲ ${rounded}% vs. mes anterior`, direction: "up" };
  return { label: `▼ ${rounded}% vs. mes anterior`, direction: "down" };
}

export const METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  otro: "Otro",
};

export const WEEKDAY_LABELS: Record<string, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};
