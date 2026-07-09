ALTER TABLE "time_blocks" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
CREATE INDEX "time_blocks_booking_idx" ON "time_blocks" USING btree ("booking_id");