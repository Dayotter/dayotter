ALTER TABLE "event_types" ADD COLUMN "locations" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "location_type" "location_type";