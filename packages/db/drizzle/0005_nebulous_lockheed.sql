CREATE TYPE "public"."payment_status" AS ENUM('none', 'pending', 'paid', 'refunded');--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "deposit_amount" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_status" "payment_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "amount_paid" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_currency" text;