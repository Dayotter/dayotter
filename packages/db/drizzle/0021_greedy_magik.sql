ALTER TYPE "public"."calendar_provider" ADD VALUE 'ics';--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN "is_read_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendars" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;