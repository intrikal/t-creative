CREATE TYPE "public"."legal_document_type" AS ENUM('privacy_policy', 'terms_of_service');--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "legal_document_type" NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effective_date" date NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"change_notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "legal_documents_type_idx" ON "legal_documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "legal_documents_published_idx" ON "legal_documents" USING btree ("type","is_published");--> statement-breakpoint
CREATE INDEX "legal_documents_effective_date_idx" ON "legal_documents" USING btree ("type","effective_date");