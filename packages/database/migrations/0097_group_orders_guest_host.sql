-- 0097: group_orders guest host foundation
--
-- Legacy track preserves its original ON DELETE CASCADE behavior on
-- group_orders.created_by from 0017_group_ordering_system.sql.

DROP TABLE IF EXISTS `__new_group_orders`;
--> statement-breakpoint

CREATE TABLE `__new_group_orders` (
    id TEXT PRIMARY KEY,
    share_code TEXT UNIQUE NOT NULL,
    master_order_id TEXT,
    created_by TEXT,
    recovery_code TEXT NOT NULL,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordering', 'checkout', 'completed', 'cancelled')),
    split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'proportional', 'individual', 'custom')),
    expires_at DATETIME NOT NULL,
    locked_at DATETIME,
    completed_at DATETIME,
    settings TEXT DEFAULT '{}',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount_cents INTEGER,
    tax_amount_cents INTEGER,
    service_charge_cents INTEGER,
    final_amount_cents INTEGER,
    FOREIGN KEY (master_order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);
--> statement-breakpoint

INSERT INTO `__new_group_orders` (
  `id`, `share_code`, `master_order_id`, `created_by`, `recovery_code`,
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at`, `locked_at`, `completed_at`, `settings`, `notes`,
  `created_at`, `updated_at`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
)
SELECT
  `id`, `share_code`, `master_order_id`, `created_by`, lower(hex(randomblob(16))),
  `restaurant_id`, `table_id`, `status`, `split_type`,
  `expires_at`, `locked_at`, `completed_at`, `settings`, `notes`,
  `created_at`, `updated_at`,
  `total_amount_cents`, `tax_amount_cents`, `service_charge_cents`, `final_amount_cents`
FROM `group_orders`;
--> statement-breakpoint

DROP TABLE `group_orders`;
--> statement-breakpoint

ALTER TABLE `__new_group_orders` RENAME TO `group_orders`;
--> statement-breakpoint

CREATE INDEX idx_group_orders_share_code ON group_orders(share_code);
--> statement-breakpoint
CREATE UNIQUE INDEX group_orders_recovery_code_unique ON group_orders(recovery_code);
--> statement-breakpoint
CREATE INDEX idx_group_orders_restaurant_id ON group_orders(restaurant_id);
--> statement-breakpoint
CREATE INDEX idx_group_orders_table_id ON group_orders(table_id);
--> statement-breakpoint
CREATE INDEX idx_group_orders_status ON group_orders(status);
--> statement-breakpoint
CREATE INDEX idx_group_orders_created_at ON group_orders(created_at);
--> statement-breakpoint
CREATE INDEX idx_group_orders_expires_at ON group_orders(expires_at);
--> statement-breakpoint

CREATE TRIGGER update_group_orders_updated_at
AFTER UPDATE ON group_orders
BEGIN
    UPDATE group_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
