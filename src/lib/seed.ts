import type {
  Category,
  IncomeSource,
  Transaction,
  UserCategoryRule,
  UserProfile,
} from "./types";
import { toMonthKey, toWeekIso } from "./dates";

export const DEFAULT_PROFILE: UserProfile = {
  id: "user-1",
  name: "Mariano J.",
  email: "mariano@example.com",
  defaultCurrency: "ARS",
  paydayWeekday: "viernes",
  initials: "MJ",
  /** Demo seed skips onboarding; "Restablecer datos demo" restores this. */
  isSetupComplete: true,
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat-alquiler",
    name: "Alquiler",
    icon: "🏠",
    color: "#5c534f",
    kind: "fijo",
    keywords: ["alquiler", "expensas", "vivienda"],
  },
  {
    id: "cat-comida",
    name: "Comida",
    icon: "🛒",
    color: "#2a7d58",
    kind: "variable",
    keywords: ["coto", "carrefour", "dia", "rappi", "pedidosya", "super", "almacen"],
  },
  {
    id: "cat-transporte",
    name: "Transporte",
    icon: "🚌",
    color: "#9a4a32",
    kind: "variable",
    keywords: ["sube", "uber", "cabify", "nafta", "estacionamiento", "colectivo"],
  },
  {
    id: "cat-salidas",
    name: "Salidas",
    icon: "🍻",
    color: "#a86b1a",
    kind: "hormiga",
    keywords: ["bar", "cine", "salida", "resto", "restaurant", "cafe"],
  },
  {
    id: "cat-salud",
    name: "Salud",
    icon: "💊",
    color: "#5f7d72",
    kind: "variable",
    keywords: ["farmacia", "obra social", "medico", "dentista"],
  },
  {
    id: "cat-servicios",
    name: "Servicios",
    icon: "📱",
    color: "#8a7a68",
    kind: "fijo",
    keywords: ["netflix", "spotify", "celular", "telefono", "cable", "gas", "luz", "agua"],
  },
  {
    id: "cat-tarjeta",
    name: "Tarjeta",
    icon: "💳",
    color: "#b07a28",
    kind: "fijo",
    keywords: ["visa", "mastercard", "resumen tarjeta"],
  },
  {
    id: "cat-ahorro",
    name: "Ahorro",
    icon: "🏦",
    color: "#3d7a5c",
    kind: "fijo",
    keywords: ["plazo fijo", "ahorro", "inversion"],
  },
  {
    id: "cat-otros",
    name: "Otros",
    icon: "📦",
    color: "#7a6f64",
    kind: "variable",
    keywords: [],
  },
];

export const DEFAULT_INCOME_SOURCES: IncomeSource[] = [
  {
    id: "src-sueldo",
    name: "Sueldo",
    type: "mensual",
    isRecurring: true,
  },
  {
    id: "src-changa",
    name: "Changa fin de semana",
    type: "semanal",
    isRecurring: true,
  },
  {
    id: "src-freelance",
    name: "Freelance",
    type: "variable",
    isRecurring: false,
  },
];

function tx(
  partial: Omit<Transaction, "weekIso" | "month" | "currency" | "origin"> & {
    currency?: Transaction["currency"];
    origin?: Transaction["origin"];
  },
): Transaction {
  return {
    currency: "ARS",
    origin: "manual",
    ...partial,
    weekIso: toWeekIso(partial.date),
    month: toMonthKey(partial.date),
  };
}

/**
 * July 2026 real calendar (Mon–Fri work weeks):
 * W1 Jun 29–Jul 3 · W2 Jul 6–10 · W3 Jul 13–17 · W4 Jul 20–24 · W5 Jul 27–31
 *
 * Totals match mockup: ingresos 412k · gastos 225.6k · balance 186.4k
 * Cats: Alquiler 77k · Comida 49.7k · Transporte 40.6k · Salidas 58.3k
 * Week cards: W1 +98k/−61.2k · W2 +95k/−102.4k · W3 +102k/−38.9k
 * Extra freelance 117k sits in W2 (raises W2 income on purpose vs mock card)
 * Alquiler on Jul 1 pushes W1 spend above mock card; category totals stay exact.
 */
export const SEED_TRANSACTIONS: Transaction[] = [
  // W1 income (Fri Jul 3)
  tx({
    id: "tx-w1-in",
    type: "ingreso",
    amount: 98000,
    date: "2026-07-03",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: "src-changa",
    note: "",
    title: "Transferencia — changa fin de semana",
    isAutoCategorized: false,
    isFixed: false,
  }),
  // Alquiler + small transport in W1 → closer to weekly spend story
  tx({
    id: "tx-alquiler",
    type: "gasto",
    amount: 77000,
    date: "2026-07-01",
    method: "transferencia",
    categoryId: "cat-alquiler",
    incomeSourceId: null,
    note: "",
    title: "Alquiler julio",
    isAutoCategorized: false,
    isFixed: true,
  }),
  // W1 variable spend to approach −61.2k card without alquiler:
  // use Jul 2 for 61200 of "operating" spend split across cats that still need room
  // Remaining after alquiler for other cats: comida 49700, transp 40600, salidas 58300
  // Put W1 non-rent = 0 and let W2/W3 carry variable — week cards won't match rent allocation.

  // Freelance (counts toward 412k; placed Mon Jul 6 → W2)
  tx({
    id: "tx-freelance",
    type: "ingreso",
    amount: 117000,
    date: "2026-07-06",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: "src-freelance",
    note: "Proyecto web",
    title: "Freelance — proyecto web",
    isAutoCategorized: false,
    isFixed: false,
  }),

  // W2 income Fri Jul 10
  tx({
    id: "tx-w2-in",
    type: "ingreso",
    amount: 95000,
    date: "2026-07-10",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: "src-changa",
    note: "",
    title: "Transferencia — changa fin de semana",
    isAutoCategorized: false,
    isFixed: false,
  }),
  // W2 expenses totaling 102400
  tx({
    id: "tx-w2-salidas",
    type: "gasto",
    amount: 48200,
    date: "2026-07-08",
    method: "tarjeta_credito",
    categoryId: "cat-salidas",
    incomeSourceId: null,
    note: "Cenas y bares",
    title: "Salidas",
    isAutoCategorized: false,
    isFixed: false,
  }),
  tx({
    id: "tx-w2-comida",
    type: "gasto",
    amount: 27400,
    date: "2026-07-09",
    method: "tarjeta_debito",
    categoryId: "cat-comida",
    incomeSourceId: null,
    note: "Carrefour",
    title: "Supermercado",
    isAutoCategorized: true,
    isFixed: false,
  }),
  tx({
    id: "tx-w2-trans",
    type: "gasto",
    amount: 26800,
    date: "2026-07-10",
    method: "efectivo",
    categoryId: "cat-transporte",
    incomeSourceId: null,
    note: "Nafta + Uber",
    title: "Transporte",
    isAutoCategorized: true,
    isFixed: false,
  }),

  // W3 income Fri Jul 17
  tx({
    id: "tx-w3-in",
    type: "ingreso",
    amount: 102000,
    date: "2026-07-17",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: "src-changa",
    note: "",
    title: "Transferencia — changa fin de semana",
    isAutoCategorized: false,
    isFixed: false,
  }),
  // W3 expenses totaling 38900
  tx({
    id: "tx-salida-w3",
    type: "gasto",
    amount: 10100,
    date: "2026-07-14",
    method: "efectivo",
    categoryId: "cat-salidas",
    incomeSourceId: null,
    note: "Café",
    title: "Salida",
    isAutoCategorized: false,
    isFixed: false,
  }),
  tx({
    id: "tx-rappi",
    type: "gasto",
    amount: 8100,
    date: "2026-07-15",
    method: "tarjeta_debito",
    categoryId: "cat-comida",
    incomeSourceId: null,
    note: "Rappi",
    title: "Rappi",
    isAutoCategorized: true,
    isFixed: false,
  }),
  tx({
    id: "tx-sube",
    type: "gasto",
    amount: 6500,
    date: "2026-07-16",
    method: "efectivo",
    categoryId: "cat-transporte",
    incomeSourceId: null,
    note: "SUBE — carga",
    title: "SUBE — carga",
    isAutoCategorized: true,
    isFixed: false,
  }),
  tx({
    id: "tx-coto",
    type: "gasto",
    amount: 14200,
    date: "2026-07-17",
    method: "tarjeta_debito",
    categoryId: "cat-comida",
    incomeSourceId: null,
    note: "Supermercado Coto",
    title: "Supermercado Coto",
    isAutoCategorized: false,
    isFixed: false,
  }),

  // Remaining to hit category totals: transp needs +7300 (40600-33300)
  tx({
    id: "tx-trans-extra",
    type: "gasto",
    amount: 7300,
    date: "2026-07-02",
    method: "efectivo",
    categoryId: "cat-transporte",
    incomeSourceId: null,
    note: "SUBE",
    title: "SUBE — carga",
    isAutoCategorized: true,
    isFixed: false,
  }),

  // June: balance 166400 → July 186400 = +12%
  // Split expenses so July "Salidas" triggers ≥20% spend alert (45k → 58.3k).
  tx({
    id: "tx-jun-in",
    type: "ingreso",
    amount: 360000,
    date: "2026-06-12",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: "src-changa",
    note: "",
    title: "Ingresos junio",
    isAutoCategorized: false,
    isFixed: false,
  }),
  tx({
    id: "tx-jun-alquiler",
    type: "gasto",
    amount: 148600,
    date: "2026-06-05",
    method: "transferencia",
    categoryId: "cat-alquiler",
    incomeSourceId: null,
    note: "",
    title: "Alquiler junio",
    isAutoCategorized: false,
    isFixed: true,
  }),
  tx({
    id: "tx-jun-salidas",
    type: "gasto",
    amount: 45000,
    date: "2026-06-20",
    method: "tarjeta_credito",
    categoryId: "cat-salidas",
    incomeSourceId: null,
    note: "Bares",
    title: "Salidas junio",
    isAutoCategorized: false,
    isFixed: false,
  }),
];

export const DEFAULT_USER_RULES: UserCategoryRule[] = [];
