CREATE TABLE "guardrail_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"source" text NOT NULL,
	"reason" text NOT NULL,
	"sample" text DEFAULT '' NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guardrail_events" ADD CONSTRAINT "guardrail_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail_events" ADD CONSTRAINT "guardrail_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardrail_events_org_idx" ON "guardrail_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "guardrail_events_notify_idx" ON "guardrail_events" USING btree ("notified_at");