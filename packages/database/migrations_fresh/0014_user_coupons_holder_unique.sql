-- One live instance of a coupon per customer (#269 §5).
--
-- Distribution is a retryable write: re-running a batch, or two admins pressing
-- distribute at the same moment, must not leave one customer holding the same
-- coupon twice. The service skips customers who already hold one, but that read
-- is not atomic against a concurrent batch, so the constraint belongs here.
--
-- Only live instances are constrained. A redeemed or expired instance has been
-- consumed, so a later campaign may legitimately issue the coupon again.
CREATE UNIQUE INDEX `user_coupons_holder_live_unique` ON `user_coupons` (`coupon_id`,`owner_customer_id`)
  WHERE `state` IN ('issued', 'reserved');
