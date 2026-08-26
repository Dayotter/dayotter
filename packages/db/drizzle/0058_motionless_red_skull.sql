ALTER TABLE "teams" ADD COLUMN "public_schedule_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_public_schedule_token_idx" ON "teams" USING btree ("public_schedule_token");