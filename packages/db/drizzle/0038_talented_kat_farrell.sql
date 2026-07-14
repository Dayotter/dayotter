CREATE TABLE "team_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"briefing_enabled" boolean DEFAULT false NOT NULL,
	"briefing_hour" smallint DEFAULT 8 NOT NULL,
	"briefing_last_sent" text,
	"briefing_recipients" text DEFAULT 'admins' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_preferences" ADD CONSTRAINT "team_preferences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_preferences_team_idx" ON "team_preferences" USING btree ("team_id");