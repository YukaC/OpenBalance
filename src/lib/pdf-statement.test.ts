import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStatementLines } from "./pdf-statement";

describe("parseStatementLines", () => {
  it("parses AR-style date + description + amount lines", () => {
    const { drafts, skippedCount } = parseStatementLines(
      [
        "Resumen de tarjeta Visa",
        "15/03/2026 MERCADOPAGO *RAPPI $12.450,00",
        "16/03/26 SUPERMERCADO DIA 8.990,50",
        "2026-03-17 NETFLIX.COM ARS 9.999,00",
        "Total del período $31.439,50",
      ],
      "ARS",
    );

    assert.equal(drafts.length, 3);
    assert.ok(skippedCount >= 2);
    assert.equal(drafts[0].date, "2026-03-15");
    assert.equal(drafts[0].amount, 12450);
    assert.match(drafts[0].title, /RAPPI/i);
    assert.equal(drafts[0].type, "gasto");
    assert.equal(drafts[0].method, "tarjeta_credito");
    assert.equal(drafts[0].origin, "importado");

    assert.equal(drafts[1].date, "2026-03-16");
    assert.equal(drafts[1].amount, 8991); // ARS rounds 8990.50 → 8991
    assert.equal(drafts[2].date, "2026-03-17");
    assert.equal(drafts[2].amount, 9999);
  });

  it("marks refund/credit lines as ingreso", () => {
    const { drafts } = parseStatementLines([
      "18/03/2026 DEVOLUCION MERCADOLIBRE $1.500,00",
      "19/03/2026 PAGO RECIBIDO -25.000,00",
    ]);

    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].type, "ingreso");
    assert.equal(drafts[0].amount, 1500);
    assert.equal(drafts[1].type, "ingreso");
    assert.equal(drafts[1].amount, 25000);
  });

  it("skips lines without date or amount", () => {
    const { drafts, skippedCount } = parseStatementLines([
      "sin monto ni fecha",
      "01/02/2026 solo titulo",
      "solo 1.234,56",
    ]);
    assert.equal(drafts.length, 0);
    assert.equal(skippedCount, 3);
  });
});
