ALTER TABLE "user_preferences" ADD COLUMN "lunch_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "lunch_start_minute" smallint DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "lunch_end_minute" smallint DEFAULT 780 NOT NULL;