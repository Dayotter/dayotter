ALTER TABLE "time_blocks" ADD COLUMN "series_id" uuid;--> statement-breakpoint
CREATE INDEX "time_blocks_series_idx" ON "time_blocks" USING btree ("series_id");