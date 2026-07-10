CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"title" text,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"location" text,
	"meeting_url" text,
	"organizer_email" text,
	"organizer_name" text,
	"attendees" jsonb,
	"status" text,
	"visibility" text,
	"transparency" text,
	"recurring_event_id" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_calendar_event_idx" ON "calendar_events" USING btree ("calendar_id","external_event_id");--> statement-breakpoint
CREATE INDEX "calendar_events_calendar_range_idx" ON "calendar_events" USING btree ("calendar_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "calendar_events_series_idx" ON "calendar_events" USING btree ("recurring_event_id");