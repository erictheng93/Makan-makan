-- `payment_status = 'paid'` cannot say whose word it is. A diner declaring
-- their own share settled and the restaurant confirming money changed hands
-- were indistinguishable, so any future revenue query reading payment_status
-- alone would have counted peer bookkeeping as takings.
ALTER TABLE split_bills ADD COLUMN settled_by TEXT;
--> statement-breakpoint

-- Every settlement recorded before this column existed was a diner's own
-- declaration: the API had no staff or provider path at all.
UPDATE split_bills SET settled_by = 'self' WHERE payment_status = 'paid';
