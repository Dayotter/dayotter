DROP INDEX "bookings_host_slot_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_host_slot_active_idx" ON "bookings" USING btree ("host_id","starts_at") WHERE "bookings"."status" IN ('confirmed', 'pending') AND "bookings"."is_group" = false;--> statement-breakpoint
-- The GiST no-overlap exclusion constraint is raw SQL (not expressible in the
-- drizzle DSL), so it isn't in the generated diff above. Widen it to also cover
-- `pending` so an opt-in request reserves its slot against overlapping bookings.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" IN ('confirmed', 'pending') AND "is_group" = false);