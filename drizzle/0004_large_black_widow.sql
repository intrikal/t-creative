CREATE TYPE "public"."form_type" AS ENUM('intake', 'waiver', 'consent', 'custom');--> statement-breakpoint
CREATE TABLE "client_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "form_type" NOT NULL,
	"description" text,
	"applies_to" text[] DEFAULT '{"All"}' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"fields" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"service_names" text[] DEFAULT '{}' NOT NULL,
	"original_price_in_cents" integer DEFAULT 0 NOT NULL,
	"bundle_price_in_cents" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
