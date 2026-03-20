CREATE TABLE "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "service_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "bookings_deleted_at_idx" ON "bookings" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "profiles_role_active_idx" ON "profiles" USING btree ("role","is_active");--> statement-breakpoint
CREATE INDEX "shifts_assistant_starts_idx" ON "shifts" USING btree ("assistant_id","starts_at");