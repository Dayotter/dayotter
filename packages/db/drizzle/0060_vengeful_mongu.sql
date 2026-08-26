DROP INDEX "bookings_host_slot_active_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "allow_overlap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_host_slot_active_idx" ON "bookings" USING btree ("host_id","starts_at") WHERE "bookings"."status" IN ('confirmed', 'pending') AND "bookings"."is_group" = false AND "bookings"."allow_overlap" = false;--> statement-breakpoint
-- The GIST no-overlap exclusion lives in raw SQL (not the drizzle DSL). Recreate it
-- with the same allow_overlap carve-out so an internal team booking that knowingly
-- overrides a commitment isn't rejected, while every public booking is still guarded.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE (status IN ('confirmed', 'pending') AND is_group = false AND allow_overlap = false);