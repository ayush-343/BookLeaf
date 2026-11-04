CREATE TABLE "ticket_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ticketId" text NOT NULL,
	"actorId" text NOT NULL,
	"actorName" text NOT NULL,
	"field" text NOT NULL,
	"before" text,
	"after" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_created" ON "ticket_events" USING btree ("ticketId","created_at");