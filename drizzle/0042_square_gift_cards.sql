-- Add Square Gift Card ID for API-managed gift cards.
-- When set, balance operations go through Square instead of local tracking.

ALTER TABLE "gift_cards"
  ADD COLUMN "square_gift_card_id" varchar(100);
