import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "date-fns";
import { getMonthWorkWeeks, getPayWeekBounds, getPayWeekPaydayIso, inferFixedPayWeekIndex } from "./dates";

function iso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

describe("getPayWeekBounds", () => {
  it("opens Sunday and closes Saturday payday", () => {
    const thursday = new Date(2026, 6, 16); // Thu 16 Jul
    const { start, end } = getPayWeekBounds(thursday, "sabado");
    assert.equal(iso(start), "2026-07-12");
    assert.equal(iso(end), "2026-07-18");
  });

  it("on payday closes the current week", () => {
    const saturday = new Date(2026, 6, 18); // Sat 18 Jul
    const { start, end } = getPayWeekBounds(saturday, "sabado");
    assert.equal(iso(start), "2026-07-12");
    assert.equal(iso(end), "2026-07-18");
  });

  it("day after payday opens the next week", () => {
    const sunday = new Date(2026, 6, 19); // Sun 19 Jul
    const { start, end } = getPayWeekBounds(sunday, "sabado");
    assert.equal(iso(start), "2026-07-19");
    assert.equal(iso(end), "2026-07-25");
  });
});

describe("getMonthWorkWeeks", () => {
  it("groups July 2026 by payday Saturday (4 weeks, spillover start OK)", () => {
    const today = new Date(2026, 6, 16);
    const weeks = getMonthWorkWeeks("2026-07", today, "sabado");

    assert.equal(weeks.length, 4);
    assert.deepEqual(
      weeks.map((week) => week.rangeLabel),
      ["28 Jun — 4 Jul", "5 — 11 Jul", "12 — 18 Jul", "19 — 25 Jul"],
    );

    assert.equal(iso(weeks[0].start), "2026-06-28");
    assert.equal(iso(weeks[0].end), "2026-07-04");
    assert.equal(iso(weeks[1].start), "2026-07-05");
    assert.equal(iso(weeks[1].end), "2026-07-11");
    assert.equal(iso(weeks[2].start), "2026-07-12");
    assert.equal(iso(weeks[2].end), "2026-07-18");
    assert.equal(iso(weeks[3].start), "2026-07-19");
    assert.equal(iso(weeks[3].end), "2026-07-25");

    assert.equal(weeks[2].isCurrent, true);
  });

  it("puts a payday that lands in August into August, not July", () => {
    const today = new Date(2026, 7, 2);
    const augustWeeks = getMonthWorkWeeks("2026-08", today, "sabado");

    assert.equal(iso(augustWeeks[0].start), "2026-07-26");
    assert.equal(iso(augustWeeks[0].end), "2026-08-01");
    assert.equal(augustWeeks[0].rangeLabel, "26 Jul — 1 Ago");
  });
});

describe("pay week fixed helpers", () => {
  it("resolves 1st and 4th payday dates for July and August 2026", () => {
    assert.equal(getPayWeekPaydayIso("2026-07", 1, "sabado"), "2026-07-04");
    assert.equal(getPayWeekPaydayIso("2026-07", 4, "sabado"), "2026-07-25");
    assert.equal(getPayWeekPaydayIso("2026-08", 1, "sabado"), "2026-08-01");
    assert.equal(getPayWeekPaydayIso("2026-08", 4, "sabado"), "2026-08-22");
  });

  it("infers week 4 even when date falls in a 5th pay week", () => {
    assert.equal(inferFixedPayWeekIndex("2026-08-29", "sabado"), 4);
    assert.equal(inferFixedPayWeekIndex("2026-07-01", "sabado"), 1);
  });
});
