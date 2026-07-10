ALTER TABLE "automation_rules" ADD COLUMN "trigger" text DEFAULT 'booking_created' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "day_of_week" smallint;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "window_start" text;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "window_end" text;