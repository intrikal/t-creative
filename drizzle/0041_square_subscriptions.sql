-- Add Square Subscriptions API columns for automated membership billing.

-- membership_plans: stores the Square Catalog subscription plan variation ID
ALTER TABLE "membership_plans"
  ADD COLUMN "square_subscription_plan_id" varchar(100);--> statement-breakpoint

-- membership_subscriptions: stores the Square Subscription ID per enrollment
ALTER TABLE "membership_subscriptions"
  ADD COLUMN "square_subscription_id" varchar(100);
