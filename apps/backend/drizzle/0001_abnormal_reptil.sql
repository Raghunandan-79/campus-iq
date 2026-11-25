CREATE TYPE "public"."college_request_status" AS ENUM('pending', 'approved', 'dismissed');--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE 'link' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "college_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"location" varchar(200),
	"website" varchar(500),
	"requested_by" uuid NOT NULL,
	"status" "college_request_status" DEFAULT 'pending' NOT NULL,
	"created_college_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "url" varchar(1000);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "batch_year" integer;--> statement-breakpoint
ALTER TABLE "college_requests" ADD CONSTRAINT "college_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "college_requests" ADD CONSTRAINT "college_requests_created_college_id_colleges_id_fk" FOREIGN KEY ("created_college_id") REFERENCES "public"."colleges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "college_requests_status_idx" ON "college_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "resources_batch_idx" ON "resources" USING btree ("batch_year");