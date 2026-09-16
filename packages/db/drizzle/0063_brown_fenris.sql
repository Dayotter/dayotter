CREATE TABLE "poll_invitees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "poll_meeting_details_template" text;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "invite_message" text;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "finalize_message" text;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "voting_mode" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_invitees" ADD CONSTRAINT "poll_invitees_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_message_templates" ADD CONSTRAINT "poll_message_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poll_invitees_poll_email_idx" ON "poll_invitees" USING btree ("poll_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_invitees_token_idx" ON "poll_invitees" USING btree ("token");--> statement-breakpoint
CREATE INDEX "poll_invitees_poll_idx" ON "poll_invitees" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_message_templates_user_idx" ON "poll_message_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_message_templates_user_name_idx" ON "poll_message_templates" USING btree ("user_id","name");