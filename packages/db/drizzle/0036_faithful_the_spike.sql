CREATE TABLE "otter_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'pattern' NOT NULL,
	"memory_key" text NOT NULL,
	"value" jsonb,
	"label" text NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"source" text DEFAULT 'derived' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "otter_memory" ADD CONSTRAINT "otter_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "otter_memory_user_key_idx" ON "otter_memory" USING btree ("user_id","memory_key");