CREATE TABLE "conferencing_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'zoom' NOT NULL,
	"external_account_id" text NOT NULL,
	"credentials" text NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conferencing_connections" ADD CONSTRAINT "conferencing_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conferencing_user_provider_idx" ON "conferencing_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "conferencing_user_idx" ON "conferencing_connections" USING btree ("user_id");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("host_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" = 'confirmed');
