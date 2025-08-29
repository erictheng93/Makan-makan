-- MakanMakan Database Migration: Seed Data
-- Created: 2025-08-26
-- Description: Initial seed data for development and testing

-- 1. Insert sample restaurants
INSERT INTO restaurants (name, description, address, phone, email, settings, status) VALUES
('MakanMakan Demo Restaurant', 'A demonstration restaurant for testing the MakanMakan system', '123 Food Street, Kuala Lumpur', '+60123456789', 'demo@makanmakan.com', '{"currency":"MYR","language":"zh-CN","timezone":"Asia/Kuala_Lumpur","tax_rate":6.0,"service_charge_rate":10.0}', 'active'),
('Kedai Kopi Uncle Lim', 'Traditional Malaysian coffee shop with local delights', '456 Heritage Lane, George Town', '+60198765432', 'unclelim@example.com', '{"currency":"MYR","language":"zh-CN","timezone":"Asia/Kuala_Lumpur","tax_rate":6.0,"service_charge_rate":0.0}', 'active');

-- 2. Insert sample users with different roles
-- Password: 'admin123' (should be hashed in production)
INSERT INTO users (username, password, email, full_name, role, restaurant_id, status) VALUES
('admin', 'admin123', 'admin@makanmakan.com', 'System Administrator', 0, NULL, 'active'),
('owner1', 'owner123', 'owner1@example.com', 'Restaurant Owner 1', 1, 1, 'active'),
('owner2', 'owner123', 'owner2@example.com', 'Restaurant Owner 2', 1, 2, 'active'),
('chef1', 'chef123', 'chef1@example.com', 'Head Chef', 2, 1, 'active'),
('service1', 'service123', 'service1@example.com', 'Service Crew Member', 3, 1, 'active'),
('cashier1', 'cashier123', 'cashier1@example.com', 'Cashier', 4, 1, 'active'),
('chef2', 'chef123', 'chef2@example.com', 'Uncle Lim Chef', 2, 2, 'active');

-- 3. Insert sample categories for Restaurant 1
INSERT INTO categories (restaurant_id, name, name_en, description, sort_order, status) VALUES
(1, '熱飲', 'Hot Beverages', '各式熱飲茶類咖啡', 1, 'active'),
(1, '冷飲', 'Cold Beverages', '新鮮果汁冰涼飲品', 2, 'active'),
(1, '主食', 'Main Dishes', '招牌主食類', 3, 'active'),
(1, '小食', 'Snacks', '精緻小點心', 4, 'active'),
(1, '甜品', 'Desserts', '傳統甜品', 5, 'active');

-- 4. Insert sample categories for Restaurant 2
INSERT INTO categories (restaurant_id, name, name_en, description, sort_order, status) VALUES
(2, '咖啡', 'Coffee', '傳統南洋咖啡', 1, 'active'),
(2, '茶類', 'Tea', '各式茶飲', 2, 'active'),
(2, '吐司', 'Toast', '炭燒吐司', 3, 'active'),
(2, '蛋類', 'Eggs', '半生熟蛋類', 4, 'active');

-- 5. Insert sample menu items for Restaurant 1
INSERT INTO menu_items (restaurant_id, category_id, name, name_en, description, price, customization_options, is_featured, is_available, sort_order) VALUES
-- Hot Beverages
(1, 1, '奶茶', 'Milk Tea', '香濃奶茶', 4.50, '{"sugar_level":["no_sugar","less_sugar","normal","extra_sugar"],"ice_level":["hot","warm"]}', true, true, 1),
(1, 1, '咖啡', 'Coffee', '精選咖啡豆', 5.00, '{"sugar_level":["no_sugar","less_sugar","normal","extra_sugar"],"milk":["no_milk","normal_milk","extra_milk","soy_milk"]}', false, true, 2),
(1, 1, '綠茶', 'Green Tea', '清香綠茶', 3.50, '{"sugar_level":["no_sugar","less_sugar","normal","extra_sugar"]}', false, true, 3),

-- Cold Beverages  
(1, 2, '冰奶茶', 'Iced Milk Tea', '冰涼奶茶', 5.00, '{"sugar_level":["no_sugar","less_sugar","normal","extra_sugar"],"ice_level":["no_ice","less_ice","normal","extra_ice"]}', true, true, 1),
(1, 2, '檸檬水', 'Lemon Water', '新鮮檸檬水', 4.00, '{"sugar_level":["no_sugar","less_sugar","normal","extra_sugar"],"ice_level":["no_ice","less_ice","normal","extra_ice"]}', false, true, 2),
(1, 2, '西瓜汁', 'Watermelon Juice', '新鮮西瓜汁', 6.00, '{"ice_level":["no_ice","less_ice","normal","extra_ice"]}', false, true, 3),

-- Main Dishes
(1, 3, '炒飯', 'Fried Rice', '招牌炒飯', 12.00, '{"spice_level":["mild","medium","spicy","extra_spicy"],"extra_egg":true}', true, true, 1),
(1, 3, '炒麵', 'Fried Noodles', '經典炒麵', 13.00, '{"spice_level":["mild","medium","spicy","extra_spicy"],"extra_veg":true}', false, true, 2),
(1, 3, '白飯', 'Plain Rice', '香噴噴白飯', 2.50, '{}', false, true, 3),

-- Snacks
(1, 4, '春卷', 'Spring Rolls', '酥脆春卷', 8.00, '{"sauce":["sweet_chili","plum_sauce","no_sauce"]}', false, true, 1),
(1, 4, '薯條', 'French Fries', '金黃薯條', 7.00, '{"seasoning":["original","salted","spicy"]}', true, true, 2),

-- Desserts
(1, 5, '紅豆冰', 'Red Bean Ice', '傳統紅豆冰', 6.50, '{"toppings":["ice_cream","corn","grass_jelly"]}', true, true, 1),
(1, 5, '椰漿飯', 'Coconut Rice', '香甜椰漿飯', 8.00, '{}', false, true, 2);

-- 6. Insert sample menu items for Restaurant 2
INSERT INTO menu_items (restaurant_id, category_id, name, name_en, description, price, customization_options, is_featured, is_available, sort_order) VALUES
-- Coffee
(2, 6, '南洋咖啡', 'Nanyang Coffee', '傳統南洋咖啡', 2.80, '{"strength":["light","medium","strong"],"sweetness":["no_sugar","less_sweet","normal","extra_sweet"]}', true, true, 1),
(2, 6, '白咖啡', 'White Coffee', '香滑白咖啡', 3.20, '{"strength":["light","medium","strong"],"sweetness":["no_sugar","less_sweet","normal","extra_sweet"]}', true, true, 2),

-- Tea
(2, 7, '拉茶', 'Teh Tarik', '經典拉茶', 2.50, '{"sweetness":["no_sugar","less_sweet","normal","extra_sweet"]}', true, true, 1),
(2, 7, '檸檬茶', 'Lemon Tea', '清香檸檬茶', 2.80, '{"sweetness":["no_sugar","less_sweet","normal","extra_sweet"],"ice":true}', false, true, 2),

-- Toast
(2, 8, '咖椰吐司', 'Kaya Toast', '傳統咖椰吐司', 3.50, '{"butter":true,"thickness":["thin","thick"]}', true, true, 1),
(2, 8, '花生醬吐司', 'Peanut Butter Toast', '香濃花生醬吐司', 3.80, '{"butter":true,"thickness":["thin","thick"]}', false, true, 2),

-- Eggs
(2, 9, '半生熟蛋', 'Half-Boiled Eggs', '完美半生熟蛋', 2.40, '{"quantity":[1,2,3]}', true, true, 1),
(2, 9, '煎蛋', 'Fried Eggs', '香煎蛋', 3.00, '{"style":["sunny_side_up","over_easy","scrambled"],"quantity":[1,2,3]}', false, true, 2);

-- 7. Insert sample tables for Restaurant 1
INSERT INTO tables (restaurant_id, table_number, table_name, capacity, qr_code, location, status) VALUES
(1, 'T01', 'Table 1', 2, 'QR_REST1_T01_' || hex(randomblob(8)), 'Near window', 'available'),
(1, 'T02', 'Table 2', 4, 'QR_REST1_T02_' || hex(randomblob(8)), 'Center area', 'available'),
(1, 'T03', 'Table 3', 4, 'QR_REST1_T03_' || hex(randomblob(8)), 'Center area', 'available'),
(1, 'T04', 'Table 4', 6, 'QR_REST1_T04_' || hex(randomblob(8)), 'Back corner', 'available'),
(1, 'T05', 'Table 5', 2, 'QR_REST1_T05_' || hex(randomblob(8)), 'Bar seating', 'available');

-- 8. Insert sample tables for Restaurant 2
INSERT INTO tables (restaurant_id, table_number, table_name, capacity, qr_code, location, status) VALUES
(2, '1', 'Table 1', 4, 'QR_REST2_T01_' || hex(randomblob(8)), 'Front area', 'available'),
(2, '2', 'Table 2', 4, 'QR_REST2_T02_' || hex(randomblob(8)), 'Middle section', 'available'),
(2, '3', 'Table 3', 2, 'QR_REST2_T03_' || hex(randomblob(8)), 'Side corner', 'available'),
(2, '4', 'Table 4', 6, 'QR_REST2_T04_' || hex(randomblob(8)), 'Back area', 'available');

-- 9. Insert sample order (for testing)
INSERT INTO orders (restaurant_id, table_id, order_number, customer_name, order_type, status, subtotal, tax_amount, total_amount) VALUES
(1, 1, 'ORD-' || date('now') || '-001', 'Test Customer', 'dine_in', 'pending', 21.00, 1.26, 22.26);

-- 10. Insert sample order items
INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, customizations) VALUES
(1, 1, 2, 4.50, 9.00, '{"sugar_level":"normal","ice_level":"hot"}'),
(1, 7, 1, 12.00, 12.00, '{"spice_level":"medium","extra_egg":true}');

-- 11. Insert sample audit log
INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address) VALUES
(2, 'create_order', 'orders', 1, '{"order_number":"ORD-' || date('now') || '-001","table_id":1,"total_amount":22.26}', '127.0.0.1');

-- Update order total after items are inserted
UPDATE orders SET 
    subtotal = (SELECT SUM(total_price) FROM order_items WHERE order_id = 1),
    tax_amount = ROUND((SELECT SUM(total_price) FROM order_items WHERE order_id = 1) * 0.06, 2),
    total_amount = ROUND((SELECT SUM(total_price) FROM order_items WHERE order_id = 1) * 1.06, 2)
WHERE id = 1;