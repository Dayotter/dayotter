CREATE TABLE "crm_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_account_id" text NOT NULL,
	"account_label" text,
	"credentials" text NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_contact_id" text,
	"external_activity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_references" ADD CONSTRAINT "crm_references_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_references" ADD CONSTRAINT "crm_references_connection_id_crm_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."crm_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_user_provider_idx" ON "crm_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "crm_user_idx" ON "crm_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_ref_booking_conn_idx" ON "crm_references" USING btree ("booking_id","connection_id");--> statement-breakpoint
CREATE INDEX "crm_ref_booking_idx" ON "crm_references" USING btree ("booking_id");