ALTER TABLE "event_types" ADD COLUMN "recurring_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "recurring_frequency" text DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "recurrence_uid" text;