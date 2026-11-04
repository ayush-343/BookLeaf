ALTER TABLE "ai_runs" ADD COLUMN "actorId" text;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_actorId_user_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_author_created" ON "tickets" USING btree ("authorId","created_at");--> statement-breakpoint
CREATE INDEX "tickets_status_created" ON "tickets" USING btree ("status","created_at");