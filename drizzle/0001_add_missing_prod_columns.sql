-- Additive migration for existing Neon DBs that predate savings/FX/classifier fields.
-- Safe to re-run (IF NOT EXISTS). Prefer: DATABASE_URL=... pnpm db:push

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "monthly_savings_goal" double precision;

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "manual_exchange_rate" double precision;

ALTER TABLE "user_rules"
  ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 0 NOT NULL;

ALTER TABLE "user_rules"
  ADD COLUMN IF NOT EXISTS "confirm_count" integer DEFAULT 1 NOT NULL;

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "transfer_group_id" text;

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_unique"
  ON "password_reset_tokens" USING btree ("token_hash");
