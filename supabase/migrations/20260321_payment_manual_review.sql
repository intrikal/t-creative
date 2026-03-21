-- Flag payments where Square order metadata could not be resolved,
-- requiring admin verification of deposit/balance classification.
ALTER TABLE payments ADD COLUMN needs_manual_review boolean NOT NULL DEFAULT false;
