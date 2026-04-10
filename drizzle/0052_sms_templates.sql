-- SMS template system — allows admins to customise automated text messages
-- instead of having them hardcoded in cron jobs.

CREATE TABLE IF NOT EXISTS "sms_templates" (
  "id" serial PRIMARY KEY,
  "slug" varchar(100) NOT NULL UNIQUE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "body" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "sms_templates_slug_idx" ON "sms_templates"("slug");

-- Seed the two existing hardcoded templates.

INSERT INTO "sms_templates" ("slug", "name", "description", "body", "variables") VALUES
  (
    'booking-reminder',
    'Booking Reminder',
    'Sent 24h/48h before an upcoming appointment.',
    'Hi {{clientFirstName}}! Reminder: your {{serviceName}} appt at {{businessName}} is {{startsAtFormatted}}. Reply C to confirm or X to cancel. Reply STOP to opt out.',
    '["clientFirstName", "serviceName", "businessName", "startsAtFormatted"]'
  ),
  (
    'birthday-promo',
    'Birthday Promo',
    'Sent 7 days before a client''s birthday with a discount code.',
    'Happy early birthday, {{firstName}}! 🎂 Use code {{promoCode}} for {{discountPercent}}% off your next visit at {{businessName}}. Valid for 30 days after your birthday. Reply STOP to opt out.',
    '["firstName", "promoCode", "discountPercent", "businessName"]'
  );
