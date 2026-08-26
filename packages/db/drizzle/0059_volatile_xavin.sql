CREATE TABLE "booking_hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_hosts_booking_user_idx" ON "booking_hosts" USING btree ("booking_id","user_id");--> statement-breakpoint
CREATE INDEX "booking_hosts_user_idx" ON "booking_hosts" USING btree ("user_id");--> statement-breakpoint
-- Backfill: the primary host is always known on historical collective bookings.
INSERT INTO "booking_hosts" ("id", "booking_id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), b."id", b."host_id", now(), now()
FROM "bookings" b
JOIN "event_types" et ON et."id" = b."event_type_id"
WHERE et."scheduling_type" = 'collective'
ON CONFLICT ("booking_id", "user_id") DO NOTHING;--> statement-breakpoint
-- Backfill: existing collective co-hosts were only stored as attendees.
-- Reconstruct those host links, without assigning old meetings to members who
-- joined the event type afterwards (matched by attendee email = host email).
INSERT INTO "booking_hosts" ("id", "booking_id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), b."id", eth."user_id", now(), now()
FROM "bookings" b
JOIN "event_types" et ON et."id" = b."event_type_id"
JOIN "event_type_hosts" eth ON eth."event_type_id" = et."id"
JOIN "users" u ON u."id" = eth."user_id"
JOIN "booking_attendees" ba ON ba."booking_id" = b."id" AND lower(ba."email") = lower(u."email")
WHERE et."scheduling_type" = 'collective'
ON CONFLICT ("booking_id", "user_id") DO NOTHING;