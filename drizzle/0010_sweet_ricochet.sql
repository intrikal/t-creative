ALTER TABLE "orders" ADD COLUMN "fulfillment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "service_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;