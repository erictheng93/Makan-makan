ALTER TABLE `shop_subscriptions`
  ADD COLUMN `deployment_mode` text DEFAULT 'managed' NOT NULL;
