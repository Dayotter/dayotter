-- Hard database guard against double-booking, including cross-duration overlaps
-- that the (host_id, starts_at) unique index misses (e.g. a 60-min booking at
-- 09:00 and a 30-min at 09:30). Uses a GiST exclusion over the time range;
-- tstzrange is half-open '[)' so back-to-back bookings (…09:30) and (09:30…) do
-- NOT overlap. Enforced only for confirmed bookings so a cancelled slot frees up.
-- Not expressible in the drizzle schema DSL — applied as raw SQL.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" = 'confirmed');
