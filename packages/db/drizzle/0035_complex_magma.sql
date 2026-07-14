CREATE TABLE "package_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"client_email" text NOT NULL,
	"total_credits" integer NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"session_count" integer NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "package_credits" ADD CONSTRAINT "package_credits_package_id_session_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."session_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_credits" ADD CONSTRAINT "package_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_credits" ADD CONSTRAINT "package_credits_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_packages" ADD CONSTRAINT "session_packages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_packages" ADD CONSTRAINT "session_packages_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_credits_lookup_idx" ON "package_credits" USING btree ("event_type_id","client_email");--> statement-breakpoint
CREATE UNIQUE INDEX "package_credits_pi_idx" ON "package_credits" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "session_packages_event_type_idx" ON "session_packages" USING btree ("event_type_id");