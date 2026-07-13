CREATE TABLE "routing_form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"routed_event_type_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fallback_event_type_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routing_form_responses" ADD CONSTRAINT "routing_form_responses_form_id_routing_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."routing_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_forms" ADD CONSTRAINT "routing_forms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routing_form_responses_form_idx" ON "routing_form_responses" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_forms_token_idx" ON "routing_forms" USING btree ("token");--> statement-breakpoint
CREATE INDEX "routing_forms_host_idx" ON "routing_forms" USING btree ("host_id");