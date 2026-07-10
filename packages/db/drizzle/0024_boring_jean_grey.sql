DROP INDEX "bookings_host_slot_active_idx";--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "max_attendees" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_host_slot_active_idx" ON "bookings" USING btree ("host_id","starts_at") WHERE "bookings"."status" = 'confirmed' AND "bookings"."is_group" = false;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" = 'confirmed' AND "is_group" = false);
