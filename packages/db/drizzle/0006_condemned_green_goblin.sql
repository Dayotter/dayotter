ALTER TABLE "event_types" ADD COLUMN "minimum_gap_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "duration_options" jsonb;