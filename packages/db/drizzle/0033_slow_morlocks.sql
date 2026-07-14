ALTER TABLE "user_preferences" ADD COLUMN "briefing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "briefing_hour" smallint DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "briefing_last_sent" text;