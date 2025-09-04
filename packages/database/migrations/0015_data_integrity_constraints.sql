-- Data Integrity Constraints Migration
-- Created: 2025-09-03
-- Description: Adds comprehensive data validation triggers and constraints

-- =================================================================
-- 1. 訂單金額一致性檢查
-- =================================================================

-- 確保訂單總金額計算正確
CREATE TRIGGER IF NOT EXISTS validate_order_amount_on_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.total_amount != (NEW.subtotal + NEW.tax_amount + NEW.service_charge - NEW.discount_amount)
        THEN RAISE(ABORT, 'Order total amount calculation mismatch')
        WHEN NEW.subtotal < 0 OR NEW.tax_amount < 0 OR NEW.service_charge < 0 OR NEW.discount_amount < 0
        THEN RAISE(ABORT, 'Order amounts cannot be negative')
        WHEN NEW.total_amount <= 0 
        THEN RAISE(ABORT, 'Order total amount must be greater than zero')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_order_amount_on_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.total_amount != (NEW.subtotal + NEW.tax_amount + NEW.service_charge - NEW.discount_amount)
        THEN RAISE(ABORT, 'Order total amount calculation mismatch')
        WHEN NEW.subtotal < 0 OR NEW.tax_amount < 0 OR NEW.service_charge < 0 OR NEW.discount_amount < 0
        THEN RAISE(ABORT, 'Order amounts cannot be negative')
        WHEN NEW.total_amount <= 0 
        THEN RAISE(ABORT, 'Order total amount must be greater than zero')
    END;
END;

-- 驗證訂單項目價格計算
CREATE TRIGGER IF NOT EXISTS validate_order_item_amount_on_insert
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.total_price != (NEW.unit_price * NEW.quantity)
        THEN RAISE(ABORT, 'Order item total price calculation mismatch')
        WHEN NEW.unit_price <= 0 
        THEN RAISE(ABORT, 'Order item unit price must be greater than zero')
        WHEN NEW.quantity <= 0 
        THEN RAISE(ABORT, 'Order item quantity must be greater than zero')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_order_item_amount_on_update
BEFORE UPDATE ON order_items
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.total_price != (NEW.unit_price * NEW.quantity)
        THEN RAISE(ABORT, 'Order item total price calculation mismatch')
        WHEN NEW.unit_price <= 0 
        THEN RAISE(ABORT, 'Order item unit price must be greater than zero')
        WHEN NEW.quantity <= 0 
        THEN RAISE(ABORT, 'Order item quantity must be greater than zero')
    END;
END;

-- =================================================================
-- 2. 桌台預訂容量檢查
-- =================================================================

-- 確保預訂人數不超過桌台容量
CREATE TRIGGER IF NOT EXISTS validate_table_reservation_capacity
BEFORE INSERT ON table_reservations
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.party_size > (SELECT capacity FROM tables WHERE id = NEW.table_id)
        THEN RAISE(ABORT, 'Reservation party size exceeds table capacity')
        WHEN NEW.party_size <= 0
        THEN RAISE(ABORT, 'Reservation party size must be greater than zero')
        WHEN NEW.reservation_date < DATE('now')
        THEN RAISE(ABORT, 'Reservation date cannot be in the past')
    END;
END;

-- 檢查桌台重複預訂
CREATE TRIGGER IF NOT EXISTS validate_table_double_booking
BEFORE INSERT ON table_reservations
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 FROM table_reservations 
            WHERE table_id = NEW.table_id 
              AND reservation_date = NEW.reservation_date
              AND reservation_time = NEW.reservation_time
              AND status NOT IN ('cancelled', 'no_show', 'completed')
        )
        THEN RAISE(ABORT, 'Table already reserved for this date and time')
    END;
END;

-- =================================================================
-- 3. 庫存數量驗證
-- =================================================================

-- 確保庫存數量不會變成負數
CREATE TRIGGER IF NOT EXISTS validate_inventory_stock_levels
BEFORE UPDATE ON inventory_items
FOR EACH ROW
WHEN NEW.current_stock != OLD.current_stock
BEGIN
    SELECT CASE 
        WHEN NEW.current_stock < 0 
        THEN RAISE(ABORT, 'Inventory stock cannot be negative')
        WHEN NEW.min_stock_level < 0 
        THEN RAISE(ABORT, 'Minimum stock level cannot be negative')
        WHEN NEW.max_stock_level IS NOT NULL AND NEW.max_stock_level <= NEW.min_stock_level
        THEN RAISE(ABORT, 'Maximum stock level must be greater than minimum stock level')
    END;
END;

-- 庫存異動數量驗證
CREATE TRIGGER IF NOT EXISTS validate_stock_movement_quantities
BEFORE INSERT ON stock_movements
FOR EACH ROW
BEGIN
    DECLARE current_stock DECIMAL(10,2);
    
    SELECT current_stock INTO current_stock 
    FROM inventory_items 
    WHERE id = NEW.inventory_item_id;
    
    SELECT CASE 
        WHEN NEW.quantity <= 0 
        THEN RAISE(ABORT, 'Stock movement quantity must be greater than zero')
        WHEN NEW.movement_type IN ('out', 'waste') AND NEW.quantity > current_stock
        THEN RAISE(ABORT, 'Cannot remove more stock than available')
        WHEN NEW.unit_cost IS NOT NULL AND NEW.unit_cost < 0
        THEN RAISE(ABORT, 'Unit cost cannot be negative')
    END;
END;

-- =================================================================
-- 4. 用戶角色和權限驗證
-- =================================================================

-- 驗證用戶角色的有效性
CREATE TRIGGER IF NOT EXISTS validate_user_role_assignment
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.role NOT IN (0, 1, 2, 3, 4)
        THEN RAISE(ABORT, 'Invalid user role. Must be 0-4 (Admin, Owner, Chef, Service, Cashier)')
        WHEN NEW.role IN (1, 2, 3, 4) AND NEW.restaurant_id IS NULL
        THEN RAISE(ABORT, 'Restaurant staff must be assigned to a restaurant')
        WHEN LENGTH(TRIM(NEW.username)) < 3
        THEN RAISE(ABORT, 'Username must be at least 3 characters long')
        WHEN LENGTH(TRIM(NEW.password)) < 6
        THEN RAISE(ABORT, 'Password must be at least 6 characters long')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_user_role_update
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.role NOT IN (0, 1, 2, 3, 4)
        THEN RAISE(ABORT, 'Invalid user role. Must be 0-4 (Admin, Owner, Chef, Service, Cashier)')
        WHEN NEW.role IN (1, 2, 3, 4) AND NEW.restaurant_id IS NULL
        THEN RAISE(ABORT, 'Restaurant staff must be assigned to a restaurant')
    END;
END;

-- =================================================================
-- 5. 菜單價格驗證
-- =================================================================

-- 確保菜單項目價格合理
CREATE TRIGGER IF NOT EXISTS validate_menu_item_price
BEFORE INSERT ON menu_items
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.price <= 0 
        THEN RAISE(ABORT, 'Menu item price must be greater than zero')
        WHEN NEW.price > 9999.99 
        THEN RAISE(ABORT, 'Menu item price cannot exceed 9999.99')
        WHEN LENGTH(TRIM(NEW.name)) < 2
        THEN RAISE(ABORT, 'Menu item name must be at least 2 characters long')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_menu_item_price_update
BEFORE UPDATE ON menu_items
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.price <= 0 
        THEN RAISE(ABORT, 'Menu item price must be greater than zero')
        WHEN NEW.price > 9999.99 
        THEN RAISE(ABORT, 'Menu item price cannot exceed 9999.99')
    END;
END;

-- 菜單選項價格調整驗證
CREATE TRIGGER IF NOT EXISTS validate_menu_option_price_adjustment
BEFORE INSERT ON menu_item_options
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN ABS(NEW.price_adjustment) > 999.99
        THEN RAISE(ABORT, 'Price adjustment cannot exceed ±999.99')
    END;
END;

-- =================================================================
-- 6. 時間邏輯驗證
-- =================================================================

-- 營業時間邏輯驗證
CREATE TRIGGER IF NOT EXISTS validate_business_hours_logic
BEFORE INSERT ON restaurant_business_hours
FOR EACH ROW
WHEN NEW.open_time IS NOT NULL AND NEW.close_time IS NOT NULL
     AND NEW.is_24_hours = FALSE AND NEW.is_closed = FALSE
BEGIN
    SELECT CASE 
        WHEN NEW.open_time >= NEW.close_time AND NEW.close_time != '00:00:00'
        THEN RAISE(ABORT, 'Open time must be before close time (unless crossing midnight)')
        WHEN NEW.break_start_time IS NOT NULL AND NEW.break_end_time IS NOT NULL
         AND NEW.break_start_time >= NEW.break_end_time
        THEN RAISE(ABORT, 'Break start time must be before break end time')
        WHEN NEW.break_start_time IS NOT NULL 
         AND (NEW.break_start_time < NEW.open_time OR NEW.break_start_time > NEW.close_time)
         AND NEW.close_time != '00:00:00'
        THEN RAISE(ABORT, 'Break time must be within business hours')
    END;
END;

-- 特殊營業日時間驗證
CREATE TRIGGER IF NOT EXISTS validate_special_hours_logic
BEFORE INSERT ON restaurant_special_hours
FOR EACH ROW
WHEN NEW.open_time IS NOT NULL AND NEW.close_time IS NOT NULL
     AND NEW.is_24_hours = FALSE AND NEW.is_closed = FALSE
BEGIN
    SELECT CASE 
        WHEN NEW.open_time >= NEW.close_time AND NEW.close_time != '00:00:00'
        THEN RAISE(ABORT, 'Special hours: Open time must be before close time')
        WHEN NEW.special_date < DATE('now')
        THEN RAISE(ABORT, 'Special hours date cannot be in the past')
    END;
END;

-- 菜單供應時間驗證
CREATE TRIGGER IF NOT EXISTS validate_menu_availability_schedule
BEFORE INSERT ON menu_item_availability_schedule
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.start_time >= NEW.end_time AND NEW.end_time != '00:00:00'
        THEN RAISE(ABORT, 'Menu availability start time must be before end time')
        WHEN NEW.day_of_week < 0 OR NEW.day_of_week > 6
        THEN RAISE(ABORT, 'Day of week must be between 0 (Sunday) and 6 (Saturday)')
    END;
END;

-- =================================================================
-- 7. 支付交易驗證
-- =================================================================

-- 支付金額驗證
CREATE TRIGGER IF NOT EXISTS validate_payment_transaction_amount
BEFORE INSERT ON payment_transactions
FOR EACH ROW
BEGIN
    DECLARE order_total DECIMAL(10,2);
    
    SELECT total_amount INTO order_total 
    FROM orders 
    WHERE id = NEW.order_id;
    
    SELECT CASE 
        WHEN NEW.amount <= 0 
        THEN RAISE(ABORT, 'Payment amount must be greater than zero')
        WHEN NEW.amount > order_total * 1.1  -- 允許10%的容錯空間（小費等）
        THEN RAISE(ABORT, 'Payment amount significantly exceeds order total')
        WHEN LENGTH(TRIM(NEW.transaction_id)) < 5
        THEN RAISE(ABORT, 'Transaction ID must be at least 5 characters long')
    END;
END;

-- =================================================================
-- 8. QR 碼完整性驗證
-- =================================================================

-- QR 碼內容驗證
CREATE TRIGGER IF NOT EXISTS validate_qr_code_content
BEFORE INSERT ON qr_codes
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN LENGTH(TRIM(NEW.content)) < 10
        THEN RAISE(ABORT, 'QR code content must be at least 10 characters long')
        WHEN NEW.format NOT IN ('png', 'svg', 'pdf', 'jpeg')
        THEN RAISE(ABORT, 'Invalid QR code format. Must be png, svg, pdf, or jpeg')
        WHEN LENGTH(NEW.url) > 2048
        THEN RAISE(ABORT, 'QR code URL cannot exceed 2048 characters')
    END;
END;

-- =================================================================
-- 9. 評價系統驗證
-- =================================================================

-- 客戶評價驗證
CREATE TRIGGER IF NOT EXISTS validate_customer_review
BEFORE INSERT ON customer_reviews
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NEW.rating < 1 OR NEW.rating > 5
        THEN RAISE(ABORT, 'Rating must be between 1 and 5')
        WHEN LENGTH(TRIM(NEW.comment)) > 1000
        THEN RAISE(ABORT, 'Review comment cannot exceed 1000 characters')
        WHEN LENGTH(TRIM(NEW.comment)) < 5 AND NEW.rating IN (1, 2)
        THEN RAISE(ABORT, 'Low ratings require a comment explaining the reason')
    END;
END;

-- =================================================================
-- 10. 餐廳設置驗證
-- =================================================================

-- 餐廳設置值驗證
CREATE TRIGGER IF NOT EXISTS validate_restaurant_settings_values
BEFORE INSERT ON restaurant_settings
FOR EACH ROW
BEGIN
    SELECT CASE 
        -- 驗證數字類型設置
        WHEN NEW.setting_type = 'number' AND NEW.setting_value NOT GLOB '[0-9]*' 
         AND NEW.setting_value NOT GLOB '[0-9]*.[0-9]*'
        THEN RAISE(ABORT, 'Invalid number format for numeric setting')
        
        -- 驗證布林類型設置
        WHEN NEW.setting_type = 'boolean' AND NEW.setting_value NOT IN ('true', 'false', '1', '0')
        THEN RAISE(ABORT, 'Invalid boolean value. Must be true/false or 1/0')
        
        -- 驗證特定設置的值範圍
        WHEN NEW.setting_key = 'service_charge_rate' AND CAST(NEW.setting_value AS DECIMAL) > 25.0
        THEN RAISE(ABORT, 'Service charge rate cannot exceed 25%')
        
        WHEN NEW.setting_key = 'tax_rate' AND CAST(NEW.setting_value AS DECIMAL) > 50.0
        THEN RAISE(ABORT, 'Tax rate cannot exceed 50%')
        
        WHEN NEW.setting_key = 'min_order_amount' AND CAST(NEW.setting_value AS DECIMAL) < 0
        THEN RAISE(ABORT, 'Minimum order amount cannot be negative')
        
        WHEN NEW.setting_key = 'estimated_prep_time' AND CAST(NEW.setting_value AS INTEGER) > 240
        THEN RAISE(ABORT, 'Estimated preparation time cannot exceed 240 minutes')
    END;
END;

-- =================================================================
-- 11. 資料完整性檢查視圖
-- =================================================================

-- 創建數據完整性檢查視圖
CREATE VIEW IF NOT EXISTS data_integrity_report AS
SELECT 
    'orders_amount_mismatch' as check_type,
    COUNT(*) as issues_count,
    'Orders with incorrect total amount calculation' as description
FROM orders 
WHERE total_amount != (subtotal + tax_amount + service_charge - discount_amount)
UNION ALL
SELECT 
    'order_items_price_mismatch',
    COUNT(*),
    'Order items with incorrect total price calculation'
FROM order_items 
WHERE total_price != (unit_price * quantity)
UNION ALL
SELECT 
    'negative_inventory_stock',
    COUNT(*),
    'Inventory items with negative stock levels'
FROM inventory_items 
WHERE current_stock < 0
UNION ALL
SELECT 
    'invalid_business_hours',
    COUNT(*),
    'Business hours with open time >= close time'
FROM restaurant_business_hours 
WHERE open_time >= close_time AND close_time != '00:00:00' AND is_24_hours = 0 AND is_closed = 0
UNION ALL
SELECT 
    'reservation_capacity_exceeded',
    COUNT(*),
    'Reservations exceeding table capacity'
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.party_size > t.capacity AND tr.status NOT IN ('cancelled', 'no_show')
UNION ALL
SELECT 
    'orphaned_order_items',
    COUNT(*),
    'Order items without corresponding orders'
FROM order_items 
WHERE order_id NOT IN (SELECT id FROM orders)
UNION ALL
SELECT 
    'invalid_user_roles',
    COUNT(*),
    'Users with invalid role assignments'
FROM users 
WHERE role NOT IN (0, 1, 2, 3, 4) OR (role IN (1, 2, 3, 4) AND restaurant_id IS NULL);

-- 完整性檢查統計視圖
CREATE VIEW IF NOT EXISTS integrity_check_summary AS
SELECT 
    (SELECT COUNT(*) FROM data_integrity_report WHERE issues_count > 0) as total_issue_types,
    (SELECT SUM(issues_count) FROM data_integrity_report) as total_issues,
    datetime('now') as last_checked
FROM data_integrity_report
LIMIT 1;

-- =================================================================
-- 12. 定期完整性檢查觸發器
-- =================================================================

-- 創建數據完整性檢查日誌表
CREATE TABLE IF NOT EXISTS data_integrity_check_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_type TEXT NOT NULL,
    issues_found INTEGER DEFAULT 0,
    issues_fixed INTEGER DEFAULT 0,
    check_details TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'warning')),
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 每1000筆新訂單後執行完整性檢查
CREATE TRIGGER IF NOT EXISTS periodic_integrity_check
AFTER INSERT ON orders
WHEN NEW.id % 1000 = 0
BEGIN
    INSERT INTO data_integrity_check_logs (check_type, issues_found, check_details)
    SELECT 
        check_type,
        issues_count,
        description
    FROM data_integrity_report
    WHERE issues_count > 0;
END;

-- =================================================================
-- 完成
-- =================================================================

-- 數據完整性約束創建完成
-- 
-- 主要約束：
-- 1. 訂單金額一致性檢查
-- 2. 桌台預訂容量檢查
-- 3. 庫存數量驗證
-- 4. 用戶角色和權限驗證
-- 5. 菜單價格驗證
-- 6. 時間邏輯驗證
-- 7. 支付交易驗證
-- 8. QR 碼完整性驗證
-- 9. 評價系統驗證
-- 10. 餐廳設置驗證
-- 11. 數據完整性檢查視圖
-- 12. 定期完整性檢查機制
--
-- 這些約束將確保數據的一致性和正確性