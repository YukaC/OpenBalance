import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampDayOfMonth,
  isDayOfMonthDate,
  resolveDayOfMonthIso,
} from "./dates";
import {
  isPaydayForProfile,
  shouldShowPaydayLoadReminder,
} from "./payday-reminder";
import type { Transaction } from "./types";

describe("clampDayOfMonth / isDayOfMonthDate", () => {
  it("clamps day 30 into February", () => {
    assert.equal(clampDayOfMonth(2026, 1, 30), 28);
    assert.equal(resolveDayOfMonthIso("2026-02", 30), "2026-02-28");
  });

  it("treats 0 as last day of month", () => {
    assert.equal(clampDayOfMonth(2026, 3, 0), 30);
    assert.equal(resolveDayOfMonthIso("2026-04", 0), "2026-04-30");
  });

  it("matches today when preferred day is clamped", () => {
    // Feb 28 2026 — preferred 30 clamps to 28
    assert.equal(isDayOfMonthDate(new Date(2026, 1, 28), 30), true);
    assert.equal(isDayOfMonthDate(new Date(2026, 1, 27), 30), false);
  });
});

describe("isPaydayForProfile / shouldShowPaydayLoadReminder", () => {
  it("monthly payday fires on day-of-month", () => {
    assert.equal(
      isPaydayForProfile(new Date(2026, 6, 30), {
        payCadence: "monthly",
        paydayWeekday: "viernes",
        paydayDayOfMonth: 30,
      }),
      true,
    );
    assert.equal(
      isPaydayForProfile(new Date(2026, 1, 28), {
        payCadence: "monthly",
        paydayWeekday: "viernes",
        paydayDayOfMonth: 30,
      }),
      true,
    );
  });

  it("monthly reminder hides when income already loaded this month", () => {
    const txs: Transaction[] = [
      {
        id: "in1",
        type: "ingreso",
        amount: 100,
        currency: "ARS",
        date: "2026-07-05",
        method: "transferencia",
        categoryId: null,
        incomeSourceId: "src-sueldo",
        note: "",
        weekIso: "2026-W27",
        month: "2026-07",
        origin: "manual",
        title: "Sueldo",
        isAutoCategorized: false,
        isFixed: false,
        deletedAt: null,
      },
    ];
    assert.equal(
      shouldShowPaydayLoadReminder(
        txs,
        {
          payCadence: "monthly",
          paydayWeekday: "viernes",
          paydayDayOfMonth: 30,
          shouldRemindPaydayLoad: true,
        },
        new Date(2026, 6, 30),
      ),
      false,
    );
    assert.equal(
      shouldShowPaydayLoadReminder(
        [],
        {
          payCadence: "monthly",
          paydayWeekday: "viernes",
          paydayDayOfMonth: 30,
          shouldRemindPaydayLoad: true,
        },
        new Date(2026, 6, 30),
      ),
      true,
    );
  });
});
