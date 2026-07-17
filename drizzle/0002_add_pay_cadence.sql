-- Additive migration: monthly/weekly pay cadence (Fase M).
-- Safe to re-run (IF NOT EXISTS). Prefer: pnpm db:migrate — never db:push on prod.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "pay_cadence" text DEFAULT 'monthly' NOT NULL;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "payday_day_of_month" integer DEFAULT 1 NOT NULL;

-- Existing users lived in the weekly pay-week model. Migrate them to weekly
-- when they already customized payday or completed setup (not brand-new rows).
UPDATE "profiles"
SET "pay_cadence" = 'weekly'
WHERE "pay_cadence" = 'monthly'
  AND (
    "is_setup_complete" = true
    OR "payday_weekday" IS DISTINCT FROM 'viernes'
    OR "should_remind_payday_load" = true
  );
