CREATE TABLE "plugin_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" text NOT NULL,
	"user_id" uuid,
	"key" text NOT NULL,
	"value" jsonb,
	"secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_data_scope_key_idx" ON "plugin_data" USING btree ("plugin_id","user_id","key");--> statement-breakpoint
CREATE INDEX "plugin_data_plugin_user_idx" ON "plugin_data" USING btree ("plugin_id","user_id");