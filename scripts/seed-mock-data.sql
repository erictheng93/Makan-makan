-- ============================================================================
-- MakanMakan Mock Data Seed Script
-- ============================================================================
-- 此腳本為本地開發環境植入完整的測試數據
-- 創建日期: 2025-01-24
-- 更新日期: 2026-02-09 (修正 schema 不匹配問題)
-- 適用於: Drizzle 生成的 schema (migrations_fresh/ 0000~0005)
-- 包含: 餐廳、員工、菜單、桌位、訂單、顧客
-- ============================================================================
--
-- ID 策略說明:
-- - restaurants 主鍵: TEXT (UUID v7，全域唯一、時間排序)
-- - 其他表主鍵: INTEGER 自動遞增
-- - 外鍵 restaurant_id: TEXT，引用 restaurants.id (UUID v7)
-- - 時間戳: INTEGER (Unix 毫秒)，欄位名稱帶 _ms 後綴
--   (例外: order_items 仍使用 created_at / updated_at，無 _ms 後綴)
--
-- ============================================================================

-- ============================================================================
-- 0. 清理舊數據（可選，小心使用）
-- ============================================================================
-- DELETE FROM order_items;
-- DELETE FROM orders;
-- DELETE FROM menu_items;
-- DELETE FROM categories;
-- DELETE FROM tables;
-- DELETE FROM customers;
-- DELETE FROM users WHERE id > 2;
-- DELETE FROM restaurants;

-- Keep seed re-runnable when restaurants are inserted with OR REPLACE.
DELETE FROM shop_subscriptions
WHERE id IN ('sub-grandma', 'sub-sakura', 'sub-siam', 'sub-demo');

-- ============================================================================
-- 1. 餐廳 (Restaurants)
-- ============================================================================
-- 主鍵: TEXT id (UUID v7 格式)
-- 注意: public_id 欄位已在 migration 0005 中移除

INSERT OR REPLACE INTO restaurants (
  id, name, type, category, description,
  address, district, city, phone, email, website,
  business_hours, is_available, is_active,
  enable_shop_mode, shop_qr_code, shop_qr_settings,
  settings, rating, review_count, total_orders,
  created_at_ms, updated_at_ms
) VALUES
-- 餐廳 1: 台式小吃
('019469a0-0001-7000-8000-000000000001', '阿嬤的味道', '中式', '台式小吃',
  '傳承三代的古早味小吃，使用在地食材，堅持手工製作',
  '台中市西屯區文心路100號', '西屯區', '台中市',
  '04-2234-5678', 'grandma@makanmakan.com', 'https://grandma-taste.com',
  '{"monday":{"open":"11:00","close":"21:00"},"tuesday":{"open":"11:00","close":"21:00"},"wednesday":{"open":"11:00","close":"21:00"},"thursday":{"open":"11:00","close":"21:00"},"friday":{"open":"11:00","close":"22:00"},"saturday":{"open":"10:00","close":"22:00"},"sunday":{"open":"10:00","close":"21:00"}}',
  1, 1,
  1, 'SHOP-GRANDMA-001', '{"displayName":"阿嬤的味道 - 外帶","instructions":"請掃描此 QR Code 進行外帶點餐","requirePhone":true}',
  '{"currency":"TWD","taxRate":0,"serviceChargeRate":0.1,"allowOnlineOrdering":true,"allowGuestOrders":true,"autoConfirmOrders":false,"enableDineIn":true,"enableTakeaway":true,"enableDelivery":true,"deliveryFee":60,"estimatedPrepTimeMin":15,"estimatedPrepTimeMax":25}',
  4.5, 128, 1520,
  unixepoch('now') * 1000, unixepoch('now') * 1000
),

-- 餐廳 2: 日式料理
('019469a0-0002-7000-8000-000000000002', '櫻花亭', '日式', '日式料理',
  '正宗日本料理，師傅來自東京，提供新鮮刺身與各式定食',
  '台中市南屯區公益路200號', '南屯區', '台中市',
  '04-2345-6789', 'sakura@makanmakan.com', 'https://sakura-tei.com',
  '{"monday":{"open":"11:30","close":"14:00"},"tuesday":{"open":"11:30","close":"14:00"},"wednesday":{"open":"11:30","close":"14:00"},"thursday":{"open":"11:30","close":"14:00"},"friday":{"open":"11:30","close":"14:00"},"saturday":{"open":"11:00","close":"21:00"},"sunday":{"open":"11:00","close":"21:00"}}',
  1, 1,
  0, NULL, NULL,
  '{"currency":"TWD","taxRate":0.05,"serviceChargeRate":0.1,"allowOnlineOrdering":true,"allowGuestOrders":true,"autoConfirmOrders":false,"minOrderAmount":300}',
  4.8, 256, 3200,
  unixepoch('now') * 1000, unixepoch('now') * 1000
),

-- 餐廳 3: 泰式料理
('019469a0-0003-7000-8000-000000000003', '暹羅風味', '泰式', '東南亞料理',
  '道地泰國風味，辣度可調整，提供各式泰式經典料理',
  '台中市北區三民路300號', '北區', '台中市',
  '04-2456-7890', 'siam@makanmakan.com', NULL,
  '{"monday":{"open":"11:00","close":"21:00"},"tuesday":{"closed":true},"wednesday":{"open":"11:00","close":"21:00"},"thursday":{"open":"11:00","close":"21:00"},"friday":{"open":"11:00","close":"22:00"},"saturday":{"open":"11:00","close":"22:00"},"sunday":{"open":"11:00","close":"21:00"}}',
  1, 1,
  1, 'SHOP-SIAM-001', '{"displayName":"暹羅風味 - 外帶","instructions":"掃碼點餐，15分鐘後取餐","requirePhone":true}',
  '{"currency":"TWD","taxRate":0,"serviceChargeRate":0,"allowOnlineOrdering":true,"allowGuestOrders":true,"autoConfirmOrders":true}',
  4.3, 89, 890,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

-- ============================================================================
-- 2. 用戶/員工 (Users)
-- ============================================================================
-- 角色: 0=Admin, 1=Owner, 2=Chef, 3=Service, 4=Cashier, 5=Customer
-- 密碼: 所有測試帳號密碼都是 'password123' (bcrypt hash)
-- restaurant_id: TEXT，引用 restaurants.id (UUID v7)

INSERT OR REPLACE INTO users (
  id, username, email, phone, full_name, password_hash,
  role, restaurant_id, is_active, is_verified,
  created_at_ms, updated_at_ms
) VALUES
-- 系統管理員
(1, 'admin', 'admin@makanmakan.com', '0912345678', '系統管理員',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  0, NULL, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 阿嬤的味道 員工
(2, 'grandmaShop', 'owner@grandma-taste.com', '0923456789', '林阿嬤',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  1, '019469a0-0001-7000-8000-000000000001', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(3, 'grandma_chef1', 'chef1@grandma-taste.com', '0934567890', '陳大廚',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  2, '019469a0-0001-7000-8000-000000000001', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(4, 'grandma_service1', 'service1@grandma-taste.com', '0945678901', '小明',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  3, '019469a0-0001-7000-8000-000000000001', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(5, 'grandma_cashier1', 'cashier1@grandma-taste.com', '0956789012', '小美',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  4, '019469a0-0001-7000-8000-000000000001', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 櫻花亭 員工
(6, 'japanShop', 'owner@sakura-tei.com', '0967890123', '田中太郎',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  1, '019469a0-0002-7000-8000-000000000002', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(7, 'sakura_chef1', 'chef1@sakura-tei.com', '0978901234', '佐藤健',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  2, '019469a0-0002-7000-8000-000000000002', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(8, 'sakura_chef2', 'chef2@sakura-tei.com', '0989012345', '山田花子',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  2, '019469a0-0002-7000-8000-000000000002', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 暹羅風味 員工
(9, 'thaiShop', 'owner@siam-flavor.com', '0990123456', 'Somchai',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  1, '019469a0-0003-7000-8000-000000000003', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

(10, 'siam_chef1', 'chef1@siam-flavor.com', '0901234567', 'Niran',
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  2, '019469a0-0003-7000-8000-000000000003', 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- ============================================================================
-- 3. 分類 (Categories)
-- ============================================================================
-- restaurant_id: TEXT，引用 restaurants.id (UUID v7)

-- Shop subscriptions required by moduleGate for owner/staff API access.
INSERT OR REPLACE INTO shop_subscriptions (
  id, restaurant_id, plan_tier, module_overrides, is_active, trial_ends_at_ms,
  billing_cycle_start_at_ms, billing_cycle_end_at_ms, notes, created_at_ms, updated_at_ms
) VALUES
('sub-grandma', '019469a0-0001-7000-8000-000000000001', 'trial', '{}', 1,
  (unixepoch('now', '+30 days') * 1000), (unixepoch('now') * 1000),
  (unixepoch('now', '+30 days') * 1000), 'Seed subscription for E2E gates',
  (unixepoch('now') * 1000), (unixepoch('now') * 1000)),
('sub-sakura', '019469a0-0002-7000-8000-000000000002', 'trial', '{}', 1,
  (unixepoch('now', '+30 days') * 1000), (unixepoch('now') * 1000),
  (unixepoch('now', '+30 days') * 1000), 'Seed subscription for E2E gates',
  (unixepoch('now') * 1000), (unixepoch('now') * 1000)),
('sub-siam', '019469a0-0003-7000-8000-000000000003', 'trial', '{}', 1,
  (unixepoch('now', '+30 days') * 1000), (unixepoch('now') * 1000),
  (unixepoch('now', '+30 days') * 1000), 'Seed subscription for E2E gates',
  (unixepoch('now') * 1000), (unixepoch('now') * 1000));

INSERT OR REPLACE INTO categories (
  id, restaurant_id, name, description, sort_order, is_active, item_count,
  created_at_ms, updated_at_ms
) VALUES
-- 阿嬤的味道 分類
(1, '019469a0-0001-7000-8000-000000000001', '招牌小吃', '店內最受歡迎的經典小吃', 1, 1, 5, unixepoch('now') * 1000, unixepoch('now') * 1000),
(2, '019469a0-0001-7000-8000-000000000001', '麵食', '各式古早味麵食', 2, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(3, '019469a0-0001-7000-8000-000000000001', '湯品', '溫暖的家常湯品', 3, 1, 3, unixepoch('now') * 1000, unixepoch('now') * 1000),
(4, '019469a0-0001-7000-8000-000000000001', '飲料', '冷熱飲品', 4, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 櫻花亭 分類
(5, '019469a0-0002-7000-8000-000000000002', '刺身', '新鮮刺身拼盤', 1, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(6, '019469a0-0002-7000-8000-000000000002', '壽司', '手握壽司與卷物', 2, 1, 5, unixepoch('now') * 1000, unixepoch('now') * 1000),
(7, '019469a0-0002-7000-8000-000000000002', '定食', '日式定食套餐', 3, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(8, '019469a0-0002-7000-8000-000000000002', '拉麵', '濃郁日式拉麵', 4, 1, 3, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 暹羅風味 分類
(9, '019469a0-0003-7000-8000-000000000003', '開胃菜', '泰式前菜與沙拉', 1, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(10, '019469a0-0003-7000-8000-000000000003', '咖哩', '經典泰式咖哩', 2, 1, 3, unixepoch('now') * 1000, unixepoch('now') * 1000),
(11, '019469a0-0003-7000-8000-000000000003', '炒飯麵', '泰式炒飯與炒麵', 3, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(12, '019469a0-0003-7000-8000-000000000003', '湯品', '酸辣泰式湯品', 4, 1, 2, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- ============================================================================
-- 4. 菜單項目 (Menu Items)
-- ============================================================================
-- restaurant_id: TEXT，引用 restaurants.id (UUID v7)

INSERT OR REPLACE INTO menu_items (
  id, restaurant_id, category_id, name, description, ingredients,
  price, original_price, is_available, is_featured, is_popular,
  sort_order, spice_level, preparation_time, calories,
  dietary_info, options, order_count, rating, review_count,
  created_at_ms, updated_at_ms
) VALUES
-- ========================
-- 阿嬤的味道 菜單
-- ========================
-- 招牌小吃
(1, '019469a0-0001-7000-8000-000000000001', 1, '滷肉飯', '阿嬤祖傳配方，肥瘦適中的五花肉搭配特製滷汁', '五花肉, 紅蔥頭, 醬油, 米酒, 白飯',
  45, NULL, 1, 1, 1, 1, 0, 5, 450,
  '{"halal":false}',
  '{"sizes":[{"id":"s1","name":"小碗","priceAdjustment":0,"isDefault":true},{"id":"s2","name":"大碗","priceAdjustment":15}],"addOns":[{"id":"a1","name":"滷蛋","price":15},{"id":"a2","name":"筍絲","price":20}]}',
  523, 4.8, 89, unixepoch('now') * 1000, unixepoch('now') * 1000),

(2, '019469a0-0001-7000-8000-000000000001', 1, '肉燥乾麵', 'Q彈麵條配上香噴噴的肉燥', '麵條, 肉燥, 豆芽, 韭菜',
  50, NULL, 1, 1, 1, 2, 0, 8, 380,
  '{}',
  '{"customizations":[{"id":"c1","name":"麵條粗細","type":"single","required":true,"choices":[{"id":"ch1","name":"細麵","isDefault":true},{"id":"ch2","name":"粗麵"}]}]}',
  412, 4.6, 67, unixepoch('now') * 1000, unixepoch('now') * 1000),

(3, '019469a0-0001-7000-8000-000000000001', 1, '蚵仔煎', '新鮮蚵仔配上雞蛋和特製醬料', '蚵仔, 雞蛋, 地瓜粉, 青菜',
  80, NULL, 1, 0, 1, 3, 0, 10, 320,
  '{"seafoodFree":false}', NULL,
  289, 4.5, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(4, '019469a0-0001-7000-8000-000000000001', 1, '臭豆腐', '外酥內嫩的臭豆腐配泡菜', '臭豆腐, 泡菜, 蒜泥, 醬油膏',
  60, NULL, 1, 0, 0, 4, 1, 8, 280,
  '{"vegan":true}', NULL,
  198, 4.3, 32, unixepoch('now') * 1000, unixepoch('now') * 1000),

(5, '019469a0-0001-7000-8000-000000000001', 1, '大腸麵線', '軟嫩大腸配上細滑麵線', '大腸, 麵線, 蒜泥, 香菜',
  70, NULL, 1, 0, 1, 5, 0, 5, 350,
  '{}',
  '{"customizations":[{"id":"c1","name":"加料","type":"multiple","required":false,"maxSelections":3,"choices":[{"id":"ch1","name":"加蚵仔","priceAdjustment":30},{"id":"ch2","name":"加大腸","priceAdjustment":25}]}]}',
  356, 4.7, 58, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 麵食
(6, '019469a0-0001-7000-8000-000000000001', 2, '陽春麵', '清爽的湯麵，簡單美味', '麵條, 青菜, 蔥花',
  40, NULL, 1, 0, 0, 1, 0, 5, 280,
  '{"vegetarian":true}', NULL,
  167, 4.2, 23, unixepoch('now') * 1000, unixepoch('now') * 1000),

(7, '019469a0-0001-7000-8000-000000000001', 2, '榨菜肉絲麵', '酸香榨菜配上嫩肉絲', '麵條, 榨菜, 肉絲, 高湯',
  65, NULL, 1, 0, 0, 2, 0, 8, 420,
  '{}', NULL,
  145, 4.4, 19, unixepoch('now') * 1000, unixepoch('now') * 1000),

(8, '019469a0-0001-7000-8000-000000000001', 2, '餛飩麵', '手工餛飩配上Q彈麵條', '餛飩, 麵條, 高湯, 青菜',
  75, NULL, 1, 0, 0, 3, 0, 10, 480,
  '{}', NULL,
  203, 4.6, 31, unixepoch('now') * 1000, unixepoch('now') * 1000),

(9, '019469a0-0001-7000-8000-000000000001', 2, '牛肉麵', '濃郁牛肉湯頭配上大塊牛腱', '牛腱肉, 麵條, 中藥材, 青菜',
  150, NULL, 1, 1, 1, 4, 1, 15, 650,
  '{}',
  '{"sizes":[{"id":"s1","name":"小碗","priceAdjustment":0},{"id":"s2","name":"大碗","priceAdjustment":30,"isDefault":true}],"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"不辣","isDefault":true},{"id":"ch2","name":"小辣"},{"id":"ch3","name":"中辣"},{"id":"ch4","name":"大辣"}]}]}',
  478, 4.9, 82, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 湯品
(10, '019469a0-0001-7000-8000-000000000001', 3, '貢丸湯', '彈牙貢丸在清甜湯頭中', '貢丸, 芹菜, 高湯',
  35, NULL, 1, 0, 0, 1, 0, 3, 120,
  '{}', NULL,
  234, 4.3, 28, unixepoch('now') * 1000, unixepoch('now') * 1000),

(11, '019469a0-0001-7000-8000-000000000001', 3, '魚丸湯', '手工魚丸配上清湯', '魚丸, 芹菜, 高湯',
  35, NULL, 1, 0, 0, 2, 0, 3, 100,
  '{"seafoodFree":false}', NULL,
  189, 4.2, 21, unixepoch('now') * 1000, unixepoch('now') * 1000),

(12, '019469a0-0001-7000-8000-000000000001', 3, '下水湯', '豬內臟熬煮的營養湯品', '豬肝, 豬腸, 薑絲, 米酒',
  55, NULL, 1, 0, 0, 3, 0, 5, 180,
  '{}', NULL,
  98, 4.1, 12, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 飲料
(13, '019469a0-0001-7000-8000-000000000001', 4, '冬瓜茶', '古早味冬瓜茶，清涼解渴', '冬瓜, 糖',
  25, NULL, 1, 0, 1, 1, 0, 1, 80,
  '{"vegan":true}',
  '{"customizations":[{"id":"c1","name":"冰量","type":"single","required":true,"choices":[{"id":"ch1","name":"正常冰","isDefault":true},{"id":"ch2","name":"少冰"},{"id":"ch3","name":"去冰"},{"id":"ch4","name":"熱飲"}]},{"id":"c2","name":"甜度","type":"single","required":true,"choices":[{"id":"ch1","name":"正常甜","isDefault":true},{"id":"ch2","name":"半糖"},{"id":"ch3","name":"微糖"},{"id":"ch4","name":"無糖"}]}]}',
  567, 4.4, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(14, '019469a0-0001-7000-8000-000000000001', 4, '青草茶', '清涼退火的青草茶', '青草, 糖',
  30, NULL, 1, 0, 0, 2, 0, 1, 60,
  '{"vegan":true}', NULL,
  234, 4.2, 23, unixepoch('now') * 1000, unixepoch('now') * 1000),

(15, '019469a0-0001-7000-8000-000000000001', 4, '紅茶', '香醇紅茶', '紅茶葉, 糖',
  20, NULL, 1, 0, 0, 3, 0, 1, 50,
  '{"vegan":true}', NULL,
  345, 4.0, 18, unixepoch('now') * 1000, unixepoch('now') * 1000),

(16, '019469a0-0001-7000-8000-000000000001', 4, '豆漿', '新鮮現磨豆漿', '黃豆, 糖',
  25, NULL, 1, 0, 0, 4, 0, 1, 120,
  '{"vegan":true}', NULL,
  278, 4.3, 29, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- ========================
-- 櫻花亭 菜單
-- ========================
-- 刺身
(17, '019469a0-0002-7000-8000-000000000002', 5, '綜合刺身', '主廚精選當日新鮮魚貨', '鮭魚, 鮪魚, 旗魚, 甜蝦',
  580, NULL, 1, 1, 1, 1, 0, 5, 280,
  '{"seafoodFree":false,"glutenFree":true}', NULL,
  189, 4.9, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(18, '019469a0-0002-7000-8000-000000000002', 5, '鮭魚刺身', '挪威空運鮭魚', '鮭魚',
  320, NULL, 1, 0, 1, 2, 0, 3, 180,
  '{"seafoodFree":false,"glutenFree":true}', NULL,
  245, 4.8, 52, unixepoch('now') * 1000, unixepoch('now') * 1000),

(19, '019469a0-0002-7000-8000-000000000002', 5, '鮪魚刺身', '黑鮪魚赤身', '鮪魚',
  420, NULL, 1, 0, 0, 3, 0, 3, 150,
  '{"seafoodFree":false,"glutenFree":true}', NULL,
  156, 4.7, 38, unixepoch('now') * 1000, unixepoch('now') * 1000),

(20, '019469a0-0002-7000-8000-000000000002', 5, '海膽刺身', '北海道新鮮海膽', '海膽',
  680, NULL, 1, 0, 0, 4, 0, 2, 120,
  '{"seafoodFree":false,"glutenFree":true}', NULL,
  89, 4.9, 28, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 壽司
(21, '019469a0-0002-7000-8000-000000000002', 6, '鮭魚握壽司', '新鮮鮭魚手握壽司 (2貫)', '鮭魚, 壽司飯, 芥末',
  120, NULL, 1, 0, 1, 1, 0, 3, 140,
  '{"seafoodFree":false}', NULL,
  456, 4.7, 78, unixepoch('now') * 1000, unixepoch('now') * 1000),

(22, '019469a0-0002-7000-8000-000000000002', 6, '鰻魚握壽司', '蒲燒鰻魚手握壽司 (2貫)', '鰻魚, 壽司飯, 醬汁',
  180, NULL, 1, 0, 0, 2, 0, 5, 200,
  '{"seafoodFree":false}', NULL,
  234, 4.8, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(23, '019469a0-0002-7000-8000-000000000002', 6, '綜合握壽司', '主廚精選8貫握壽司', '各式魚料, 壽司飯',
  480, NULL, 1, 1, 1, 3, 0, 10, 450,
  '{"seafoodFree":false}', NULL,
  312, 4.9, 67, unixepoch('now') * 1000, unixepoch('now') * 1000),

(24, '019469a0-0002-7000-8000-000000000002', 6, '加州卷', '蟹肉酪梨捲 (8片)', '蟹肉棒, 酪梨, 小黃瓜, 壽司飯',
  220, NULL, 1, 0, 0, 4, 0, 8, 320,
  '{"seafoodFree":false}', NULL,
  189, 4.5, 34, unixepoch('now') * 1000, unixepoch('now') * 1000),

(25, '019469a0-0002-7000-8000-000000000002', 6, '炙燒鮭魚卷', '炙燒鮭魚美乃滋卷 (8片)', '鮭魚, 美乃滋, 壽司飯',
  280, NULL, 1, 0, 1, 5, 0, 8, 380,
  '{"seafoodFree":false}', NULL,
  267, 4.6, 48, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 定食
(26, '019469a0-0002-7000-8000-000000000002', 7, '炸豬排定食', '酥脆炸豬排配白飯味噌湯', '豬排, 高麗菜, 白飯, 味噌湯',
  320, NULL, 1, 0, 1, 1, 0, 12, 750,
  '{}',
  '{"customizations":[{"id":"c1","name":"豬排大小","type":"single","required":true,"choices":[{"id":"ch1","name":"標準","isDefault":true},{"id":"ch2","name":"加大","priceAdjustment":50}]}]}',
  345, 4.6, 56, unixepoch('now') * 1000, unixepoch('now') * 1000),

(27, '019469a0-0002-7000-8000-000000000002', 7, '鮭魚定食', '烤鮭魚配白飯味噌湯', '鮭魚, 白飯, 味噌湯, 漬物',
  380, NULL, 1, 1, 1, 2, 0, 15, 550,
  '{"seafoodFree":false}', NULL,
  278, 4.8, 62, unixepoch('now') * 1000, unixepoch('now') * 1000),

(28, '019469a0-0002-7000-8000-000000000002', 7, '牛丼定食', '日式牛肉蓋飯', '牛肉, 洋蔥, 白飯, 味噌湯',
  280, NULL, 1, 0, 0, 3, 0, 10, 680,
  '{}', NULL,
  198, 4.5, 38, unixepoch('now') * 1000, unixepoch('now') * 1000),

(29, '019469a0-0002-7000-8000-000000000002', 7, '天婦羅定食', '酥脆天婦羅配白飯味噌湯', '蝦, 蔬菜, 白飯, 味噌湯',
  350, NULL, 1, 0, 0, 4, 0, 12, 620,
  '{"seafoodFree":false}', NULL,
  167, 4.6, 32, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 拉麵
(30, '019469a0-0002-7000-8000-000000000002', 8, '豚骨拉麵', '濃郁豬骨湯底拉麵', '豚骨湯, 叉燒, 溏心蛋, 海苔',
  280, NULL, 1, 1, 1, 1, 0, 12, 750,
  '{}',
  '{"customizations":[{"id":"c1","name":"湯頭濃度","type":"single","required":true,"choices":[{"id":"ch1","name":"普通","isDefault":true},{"id":"ch2","name":"濃厚"},{"id":"ch3","name":"超濃厚"}]},{"id":"c2","name":"麵條硬度","type":"single","required":true,"choices":[{"id":"ch1","name":"普通","isDefault":true},{"id":"ch2","name":"硬麵"},{"id":"ch3","name":"軟麵"}]}],"addOns":[{"id":"a1","name":"加蛋","price":30},{"id":"a2","name":"加叉燒","price":50}]}',
  456, 4.8, 89, unixepoch('now') * 1000, unixepoch('now') * 1000),

(31, '019469a0-0002-7000-8000-000000000002', 8, '味噌拉麵', '北海道風味味噌拉麵', '味噌湯, 叉燒, 玉米, 奶油',
  260, NULL, 1, 0, 0, 2, 0, 12, 680,
  '{}', NULL,
  234, 4.6, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(32, '019469a0-0002-7000-8000-000000000002', 8, '醬油拉麵', '清爽醬油湯底拉麵', '醬油湯, 叉燒, 筍乾, 蔥花',
  240, NULL, 1, 0, 0, 3, 0, 10, 550,
  '{}', NULL,
  189, 4.5, 38, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- ========================
-- 暹羅風味 菜單
-- ========================
-- 開胃菜
(33, '019469a0-0003-7000-8000-000000000003', 9, '涼拌青木瓜', '經典泰式沙拉，酸辣開胃', '青木瓜, 番茄, 花生, 辣椒',
  120, NULL, 1, 1, 1, 1, 3, 8, 150,
  '{"vegan":true,"glutenFree":true}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"小辣"},{"id":"ch2","name":"中辣","isDefault":true},{"id":"ch3","name":"大辣"},{"id":"ch4","name":"泰式辣"}]}]}',
  345, 4.7, 56, unixepoch('now') * 1000, unixepoch('now') * 1000),

(34, '019469a0-0003-7000-8000-000000000003', 9, '月亮蝦餅', '酥脆蝦餅配甜辣醬', '蝦仁, 魚漿, 麵包粉',
  180, NULL, 1, 0, 1, 2, 0, 10, 280,
  '{"seafoodFree":false}', NULL,
  267, 4.6, 48, unixepoch('now') * 1000, unixepoch('now') * 1000),

(35, '019469a0-0003-7000-8000-000000000003', 9, '泰式春捲', '酥脆春捲配甜辣醬 (4入)', '豬肉, 冬粉, 蔬菜',
  100, NULL, 1, 0, 0, 3, 0, 8, 220,
  '{}', NULL,
  189, 4.4, 32, unixepoch('now') * 1000, unixepoch('now') * 1000),

(36, '019469a0-0003-7000-8000-000000000003', 9, '香茅烤雞翅', '泰式香料醃製烤雞翅 (6入)', '雞翅, 香茅, 香料',
  160, NULL, 1, 0, 0, 4, 1, 12, 350,
  '{"glutenFree":true}', NULL,
  156, 4.5, 28, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 咖哩
(37, '019469a0-0003-7000-8000-000000000003', 10, '綠咖哩雞', '香濃綠咖哩配嫩雞肉', '雞肉, 綠咖哩醬, 椰奶, 茄子',
  220, NULL, 1, 1, 1, 1, 2, 15, 450,
  '{"glutenFree":true}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"小辣"},{"id":"ch2","name":"中辣","isDefault":true},{"id":"ch3","name":"大辣"}]}]}',
  289, 4.8, 62, unixepoch('now') * 1000, unixepoch('now') * 1000),

(38, '019469a0-0003-7000-8000-000000000003', 10, '紅咖哩牛肉', '香濃紅咖哩配嫩牛肉', '牛肉, 紅咖哩醬, 椰奶, 竹筍',
  260, NULL, 1, 0, 1, 2, 2, 18, 520,
  '{"glutenFree":true}', NULL,
  198, 4.7, 45, unixepoch('now') * 1000, unixepoch('now') * 1000),

(39, '019469a0-0003-7000-8000-000000000003', 10, '瑪莎曼咖哩', '溫和香甜的瑪莎曼咖哩', '雞肉, 馬鈴薯, 花生, 椰奶',
  240, NULL, 1, 0, 0, 3, 1, 15, 480,
  '{"glutenFree":true}', NULL,
  145, 4.6, 34, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 炒飯麵
(40, '019469a0-0003-7000-8000-000000000003', 11, '打拋豬肉飯', '泰式九層塔炒肉末配煎蛋', '豬絞肉, 九層塔, 辣椒, 蒜頭',
  160, NULL, 1, 1, 1, 1, 2, 10, 550,
  '{}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"小辣"},{"id":"ch2","name":"中辣","isDefault":true},{"id":"ch3","name":"大辣"}]}],"addOns":[{"id":"a1","name":"加蛋","price":15}]}',
  456, 4.7, 78, unixepoch('now') * 1000, unixepoch('now') * 1000),

(41, '019469a0-0003-7000-8000-000000000003', 11, '泰式炒河粉', '經典Pad Thai', '河粉, 蝦仁, 豆芽, 花生',
  180, NULL, 1, 0, 1, 2, 0, 12, 480,
  '{"seafoodFree":false}', NULL,
  367, 4.6, 65, unixepoch('now') * 1000, unixepoch('now') * 1000),

(42, '019469a0-0003-7000-8000-000000000003', 11, '鳳梨炒飯', '酸甜鳳梨配蝦仁炒飯', '白飯, 鳳梨, 蝦仁, 腰果',
  200, NULL, 1, 0, 0, 3, 0, 10, 520,
  '{"seafoodFree":false}', NULL,
  234, 4.5, 42, unixepoch('now') * 1000, unixepoch('now') * 1000),

(43, '019469a0-0003-7000-8000-000000000003', 11, '蟹肉炒飯', '蟹肉配上香噴噴的炒飯', '白飯, 蟹肉, 雞蛋, 蔥花',
  220, NULL, 1, 0, 0, 4, 0, 10, 480,
  '{"seafoodFree":false}', NULL,
  178, 4.4, 32, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 湯品
(44, '019469a0-0003-7000-8000-000000000003', 12, '冬蔭功湯', '經典酸辣蝦湯', '蝦, 香茅, 南薑, 檸檬葉',
  180, NULL, 1, 1, 1, 1, 3, 12, 180,
  '{"seafoodFree":false,"glutenFree":true}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"小辣"},{"id":"ch2","name":"中辣","isDefault":true},{"id":"ch3","name":"大辣"},{"id":"ch4","name":"泰式辣"}]}]}',
  312, 4.9, 78, unixepoch('now') * 1000, unixepoch('now') * 1000),

(45, '019469a0-0003-7000-8000-000000000003', 12, '椰奶雞湯', '溫和椰香雞肉湯', '雞肉, 椰奶, 南薑, 香茅',
  160, NULL, 1, 0, 0, 2, 1, 10, 320,
  '{"glutenFree":true}', NULL,
  189, 4.6, 38, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- ============================================================================
-- 5. 桌位 (Tables)
-- ============================================================================
-- restaurant_id: TEXT，引用 restaurants.id (UUID v7)

INSERT OR REPLACE INTO tables (
  id, restaurant_id, number, name, capacity, location, floor, section,
  qr_code, qr_mode, is_occupied, is_active, is_reservable,
  created_at_ms, updated_at_ms
) VALUES
-- 阿嬤的味道 桌位
(1, '019469a0-0001-7000-8000-000000000001', 'A1', '窗邊雙人桌', 2, '窗邊', 1, 'A區', 'QR-GRANDMA-A1-001', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(2, '019469a0-0001-7000-8000-000000000001', 'A2', '窗邊雙人桌', 2, '窗邊', 1, 'A區', 'QR-GRANDMA-A2-002', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(3, '019469a0-0001-7000-8000-000000000001', 'B1', '四人桌', 4, '中央', 1, 'B區', 'QR-GRANDMA-B1-003', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(4, '019469a0-0001-7000-8000-000000000001', 'B2', '四人桌', 4, '中央', 1, 'B區', 'QR-GRANDMA-B2-004', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(5, '019469a0-0001-7000-8000-000000000001', 'C1', '六人桌', 6, '角落', 1, 'C區', 'QR-GRANDMA-C1-005', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(6, '019469a0-0001-7000-8000-000000000001', 'C2', '大圓桌', 8, '包廂', 1, 'VIP', 'QR-GRANDMA-C2-006', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 櫻花亭 桌位
(7, '019469a0-0002-7000-8000-000000000002', '1', '吧台座位', 2, '吧台', 1, '吧台', 'QR-SAKURA-01-007', 'seat', 0, 1, 0, unixepoch('now') * 1000, unixepoch('now') * 1000),
(8, '019469a0-0002-7000-8000-000000000002', '2', '吧台座位', 2, '吧台', 1, '吧台', 'QR-SAKURA-02-008', 'seat', 0, 1, 0, unixepoch('now') * 1000, unixepoch('now') * 1000),
(9, '019469a0-0002-7000-8000-000000000002', '3', '窗邊四人桌', 4, '窗邊', 1, '大廳', 'QR-SAKURA-03-009', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(10, '019469a0-0002-7000-8000-000000000002', '4', '窗邊四人桌', 4, '窗邊', 1, '大廳', 'QR-SAKURA-04-010', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(11, '019469a0-0002-7000-8000-000000000002', '5', '榻榻米包廂', 6, '二樓', 2, '包廂', 'QR-SAKURA-05-011', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(12, '019469a0-0002-7000-8000-000000000002', '6', '大包廂', 10, '二樓', 2, 'VIP', 'QR-SAKURA-06-012', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 暹羅風味 桌位
(13, '019469a0-0003-7000-8000-000000000003', 'T1', '雙人桌', 2, '入口', 1, '一般', 'QR-SIAM-T1-013', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(14, '019469a0-0003-7000-8000-000000000003', 'T2', '雙人桌', 2, '入口', 1, '一般', 'QR-SIAM-T2-014', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(15, '019469a0-0003-7000-8000-000000000003', 'T3', '四人桌', 4, '中央', 1, '一般', 'QR-SIAM-T3-015', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(16, '019469a0-0003-7000-8000-000000000003', 'T4', '四人桌', 4, '中央', 1, '一般', 'QR-SIAM-T4-016', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
(17, '019469a0-0003-7000-8000-000000000003', 'T5', '六人桌', 6, '窗邊', 1, '家庭', 'QR-SIAM-T5-017', 'table', 0, 1, 1, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- ============================================================================
-- 6. 顧客 (Customers)
-- ============================================================================
-- customers 表使用 created_at / updated_at（無 _ms 後綴），且有 DEFAULT 值

INSERT OR REPLACE INTO customers (
  id, full_name, email, phone
) VALUES
('cust001', '王小明', 'xiaoming@email.com', '0912111222'),
('cust002', '李美麗', 'meili@email.com', '0923222333'),
('cust003', '張大偉', 'dawei@email.com', '0934333444'),
('cust004', '陳淑芬', 'shufen@email.com', '0945444555'),
('cust005', '林志豪', 'zhihao@email.com', '0956555666'),
('cust006', 'John Smith', 'john@email.com', '0967666777'),
('cust007', '田中花子', 'hanako@email.com', '0978777888'),
('cust008', '黃志強', 'zhiqiang@email.com', '0989888999');

-- ============================================================================
-- 7. 訂單 (Orders)
-- ============================================================================
-- restaurant_id: TEXT，引用 restaurants.id (UUID v7)

INSERT OR REPLACE INTO orders (
  id, restaurant_id, table_id, order_number, status, order_type,
  subtotal, tax_amount, service_charge, discount_amount, total_amount,
  customer_info, estimated_prep_time, payment_method, payment_status,
  notes, created_at_ms, updated_at_ms, confirmed_at_ms, preparing_at_ms, ready_at_ms
) VALUES
-- 阿嬤的味道 訂單
-- 訂單 1: 已完成
(1, '019469a0-0001-7000-8000-000000000001', 3, 'GMA-20250124-001', 'paid', 'table',
  275, 0, 27.5, 0, 302.5,
  '{"name":"王小明","phone":"0912111222","peopleCount":2}',
  15, 'cash', 'completed',
  '不要香菜', unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000,
  unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000),

-- 訂單 2: 準備中
(2, '019469a0-0001-7000-8000-000000000001', 4, 'GMA-20250124-002', 'preparing', 'table',
  195, 0, 19.5, 0, 214.5,
  '{"name":"李美麗","phone":"0923222333","peopleCount":4}',
  20, NULL, 'pending',
  NULL, unixepoch('now') * 1000 - 3600000, unixepoch('now') * 1000 - 3600000,
  unixepoch('now') * 1000 - 3600000, unixepoch('now') * 1000 - 3000000, NULL),

-- 訂單 3: 待確認
(3, '019469a0-0001-7000-8000-000000000001', 5, 'GMA-20250124-003', 'pending', 'table',
  320, 0, 32, 0, 352,
  '{"name":"張大偉","phone":"0934333444","peopleCount":6}',
  25, NULL, 'pending',
  '請盡快上菜', unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000,
  NULL, NULL, NULL),

-- 訂單 4: 外帶訂單
(4, '019469a0-0001-7000-8000-000000000001', 1, 'GMA-20250124-004', 'ready', 'shop',
  130, 0, 0, 0, 130,
  '{"name":"陳淑芬","phone":"0945444555","phoneLastDigits":"555","orderType":"shop"}',
  10, NULL, 'pending',
  '外帶', unixepoch('now') * 1000 - 1800000, unixepoch('now') * 1000 - 1800000,
  unixepoch('now') * 1000 - 1800000, unixepoch('now') * 1000 - 1500000, unixepoch('now') * 1000 - 1200000),

-- 櫻花亭 訂單
-- 訂單 5: 已完成
(5, '019469a0-0002-7000-8000-000000000002', 9, 'SKR-20250124-001', 'paid', 'table',
  1260, 63, 126, 0, 1449,
  '{"name":"林志豪","phone":"0956555666","peopleCount":4}',
  25, 'card', 'completed',
  NULL, unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000,
  unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000),

-- 訂單 6: 準備中
(6, '019469a0-0002-7000-8000-000000000002', 11, 'SKR-20250124-002', 'preparing', 'table',
  860, 43, 86, 0, 989,
  '{"name":"John Smith","phone":"0967666777","peopleCount":6}',
  30, NULL, 'pending',
  'No wasabi please', unixepoch('now') * 1000 - 2400000, unixepoch('now') * 1000 - 2400000,
  unixepoch('now') * 1000 - 2400000, unixepoch('now') * 1000 - 2100000, NULL),

-- 訂單 7: 已確認
(7, '019469a0-0002-7000-8000-000000000002', 10, 'SKR-20250124-003', 'confirmed', 'table',
  600, 30, 60, 0, 690,
  '{"name":"田中花子","phone":"0978777888","peopleCount":2}',
  20, NULL, 'pending',
  NULL, unixepoch('now') * 1000 - 900000, unixepoch('now') * 1000 - 900000,
  unixepoch('now') * 1000 - 900000, NULL, NULL),

-- 暹羅風味 訂單
-- 訂單 8: 已完成
(8, '019469a0-0003-7000-8000-000000000003', 15, 'SIM-20250124-001', 'paid', 'table',
  560, 0, 0, 0, 560,
  '{"name":"黃志強","phone":"0989888999","peopleCount":4}',
  20, 'cash', 'completed',
  '小辣就好', unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000,
  unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000),

-- 訂單 9: 準備中
(9, '019469a0-0003-7000-8000-000000000003', 16, 'SIM-20250124-002', 'preparing', 'table',
  400, 0, 0, 0, 400,
  '{"name":"王小明","phone":"0912111222","peopleCount":2}',
  15, NULL, 'pending',
  '中辣', unixepoch('now') * 1000 - 1200000, unixepoch('now') * 1000 - 1200000,
  unixepoch('now') * 1000 - 1200000, unixepoch('now') * 1000 - 900000, NULL),

-- 訂單 10: 外帶訂單
(10, '019469a0-0003-7000-8000-000000000003', 13, 'SIM-20250124-003', 'ready', 'shop',
  340, 0, 0, 0, 340,
  '{"name":"李美麗","phone":"0923222333","phoneLastDigits":"333","orderType":"shop"}',
  12, NULL, 'pending',
  '外帶，大辣', unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000,
  unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 300000, unixepoch('now') * 1000 - 60000);

-- ============================================================================
-- 8. 訂單項目 (Order Items)
-- ============================================================================
-- 注意: order_items 表的時間戳欄位已更新為 created_at_ms / updated_at_ms

INSERT OR REPLACE INTO order_items (
  id, order_id, menu_item_id, quantity, unit_price, total_price,
  item_snapshot, customizations, status, notes,
  created_at_ms, updated_at_ms
) VALUES
-- 訂單 1 項目 (阿嬤的味道)
(1, 1, 1, 2, 45, 90, '{"name":"滷肉飯","category":"招牌小吃"}', '{"size":{"id":"s1","name":"小碗"}}', 'served', NULL, unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000),
(2, 1, 9, 1, 150, 150, '{"name":"牛肉麵","category":"麵食"}', '{"size":{"id":"s2","name":"大碗"},"options":[{"optionName":"辣度","choiceName":"小辣"}]}', 'served', '不要香菜', unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000),
(3, 1, 13, 2, 25, 50, '{"name":"冬瓜茶","category":"飲料"}', '{"options":[{"optionName":"冰量","choiceName":"正常冰"},{"optionName":"甜度","choiceName":"半糖"}]}', 'served', NULL, unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000 - 86400000),

-- 訂單 2 項目 (阿嬤的味道)
(4, 2, 2, 2, 50, 100, '{"name":"肉燥乾麵","category":"招牌小吃"}', NULL, 'preparing', NULL, unixepoch('now') * 1000 - 3600000, unixepoch('now') * 1000 - 3600000),
(5, 2, 3, 1, 80, 80, '{"name":"蚵仔煎","category":"招牌小吃"}', NULL, 'preparing', NULL, unixepoch('now') * 1000 - 3600000, unixepoch('now') * 1000 - 3600000),
(6, 2, 10, 1, 35, 35, '{"name":"貢丸湯","category":"湯品"}', NULL, 'ready', NULL, unixepoch('now') * 1000 - 3600000, unixepoch('now') * 1000 - 3600000),

-- 訂單 3 項目 (阿嬤的味道)
(7, 3, 1, 4, 45, 180, '{"name":"滷肉飯","category":"招牌小吃"}', '{"size":{"id":"s2","name":"大碗","priceAdjustment":15},"addOns":[{"name":"滷蛋","price":15}]}', 'pending', NULL, unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000),
(8, 3, 5, 2, 70, 140, '{"name":"大腸麵線","category":"招牌小吃"}', NULL, 'pending', NULL, unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000),

-- 訂單 4 項目 (阿嬤的味道 - 外帶)
(9, 4, 1, 2, 45, 90, '{"name":"滷肉飯","category":"招牌小吃"}', NULL, 'ready', NULL, unixepoch('now') * 1000 - 1800000, unixepoch('now') * 1000 - 1800000),
(10, 4, 4, 1, 60, 60, '{"name":"臭豆腐","category":"招牌小吃"}', NULL, 'ready', NULL, unixepoch('now') * 1000 - 1800000, unixepoch('now') * 1000 - 1800000),

-- 訂單 5 項目 (櫻花亭)
(11, 5, 17, 1, 580, 580, '{"name":"綜合刺身","category":"刺身"}', NULL, 'served', NULL, unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000),
(12, 5, 23, 1, 480, 480, '{"name":"綜合握壽司","category":"壽司"}', NULL, 'served', NULL, unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000),
(13, 5, 30, 1, 280, 280, '{"name":"豚骨拉麵","category":"拉麵"}', '{"options":[{"optionName":"湯頭濃度","choiceName":"濃厚"},{"optionName":"麵條硬度","choiceName":"硬麵"}]}', 'served', NULL, unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 172800000),

-- 訂單 6 項目 (櫻花亭)
(14, 6, 18, 2, 320, 640, '{"name":"鮭魚刺身","category":"刺身"}', NULL, 'preparing', NULL, unixepoch('now') * 1000 - 2400000, unixepoch('now') * 1000 - 2400000),
(15, 6, 26, 2, 320, 640, '{"name":"炸豬排定食","category":"定食"}', '{"options":[{"optionName":"豬排大小","choiceName":"加大","priceAdjustment":50}]}', 'preparing', NULL, unixepoch('now') * 1000 - 2400000, unixepoch('now') * 1000 - 2400000),

-- 訂單 7 項目 (櫻花亭)
(16, 7, 21, 4, 120, 480, '{"name":"鮭魚握壽司","category":"壽司"}', NULL, 'pending', NULL, unixepoch('now') * 1000 - 900000, unixepoch('now') * 1000 - 900000),
(17, 7, 22, 2, 180, 360, '{"name":"鰻魚握壽司","category":"壽司"}', NULL, 'pending', NULL, unixepoch('now') * 1000 - 900000, unixepoch('now') * 1000 - 900000),

-- 訂單 8 項目 (暹羅風味)
(18, 8, 33, 1, 120, 120, '{"name":"涼拌青木瓜","category":"開胃菜"}', '{"options":[{"optionName":"辣度","choiceName":"小辣"}]}', 'served', NULL, unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000),
(19, 8, 37, 1, 220, 220, '{"name":"綠咖哩雞","category":"咖哩"}', '{"options":[{"optionName":"辣度","choiceName":"小辣"}]}', 'served', NULL, unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000),
(20, 8, 40, 2, 160, 320, '{"name":"打拋豬肉飯","category":"炒飯麵"}', '{"options":[{"optionName":"辣度","choiceName":"小辣"}],"addOns":[{"name":"加蛋","price":15}]}', 'served', NULL, unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000 - 259200000),

-- 訂單 9 項目 (暹羅風味)
(21, 9, 34, 1, 180, 180, '{"name":"月亮蝦餅","category":"開胃菜"}', NULL, 'preparing', NULL, unixepoch('now') * 1000 - 1200000, unixepoch('now') * 1000 - 1200000),
(22, 9, 44, 1, 180, 180, '{"name":"冬蔭功湯","category":"湯品"}', '{"options":[{"optionName":"辣度","choiceName":"中辣"}]}', 'ready', NULL, unixepoch('now') * 1000 - 1200000, unixepoch('now') * 1000 - 1200000),
(23, 9, 41, 1, 180, 180, '{"name":"泰式炒河粉","category":"炒飯麵"}', NULL, 'preparing', NULL, unixepoch('now') * 1000 - 1200000, unixepoch('now') * 1000 - 1200000),

-- 訂單 10 項目 (暹羅風味 - 外帶)
(24, 10, 33, 1, 120, 120, '{"name":"涼拌青木瓜","category":"開胃菜"}', '{"options":[{"optionName":"辣度","choiceName":"大辣"}]}', 'ready', NULL, unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000),
(25, 10, 40, 1, 160, 160, '{"name":"打拋豬肉飯","category":"炒飯麵"}', '{"options":[{"optionName":"辣度","choiceName":"大辣"}]}', 'ready', NULL, unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000),
(26, 10, 45, 1, 160, 160, '{"name":"椰奶雞湯","category":"湯品"}', NULL, 'ready', NULL, unixepoch('now') * 1000 - 600000, unixepoch('now') * 1000 - 600000);

-- ============================================================================
-- 9. Demo 餐廳 (用於 onboarding-app 查看演示)
-- ============================================================================
-- 一間融合料理風格的展示餐廳，涵蓋多種品類與客製化選項

INSERT OR REPLACE INTO restaurants (
  id, name, type, category, description,
  address, district, city, phone, email, website,
  business_hours, is_available, is_active,
  enable_shop_mode, shop_qr_code, shop_qr_settings,
  settings, rating, review_count, total_orders,
  cuisine_tags, price_range, supports_takeaway, supports_delivery,
  created_at_ms, updated_at_ms
) VALUES
('019469a0-0099-7000-8000-000000000099', 'MakanMakan Demo', '複合式', '亞洲融合料理',
  '歡迎體驗 MakanMakan 點餐系統！這是一間展示用的虛擬餐廳，您可以瀏覽菜單、加入購物車、體驗完整的點餐流程。',
  '台北市信義區松仁路100號', '信義區', '台北市',
  '02-2700-0000', 'demo@makanmakan.com', 'https://makanmakan.app',
  '{"monday":{"open":"10:00","close":"22:00"},"tuesday":{"open":"10:00","close":"22:00"},"wednesday":{"open":"10:00","close":"22:00"},"thursday":{"open":"10:00","close":"22:00"},"friday":{"open":"10:00","close":"23:00"},"saturday":{"open":"09:00","close":"23:00"},"sunday":{"open":"09:00","close":"22:00"}}',
  1, 1,
  1, 'SHOP-DEMO-001', '{"displayName":"MakanMakan Demo - 體驗點餐","instructions":"歡迎體驗！請選擇外帶或外送，輸入任意 3 位數字即可開始瀏覽菜單。","requirePhone":true}',
  '{"currency":"TWD","taxRate":0.05,"serviceChargeRate":0.1,"allowOnlineOrdering":true,"allowGuestOrders":true,"autoConfirmOrders":true,"enableTakeaway":true,"enableDelivery":true,"deliveryFee":60,"estimatedPrepTimeMin":10,"estimatedPrepTimeMax":25}',
  4.9, 520, 8800,
  '["台式","日式","泰式","義式"]', 2, 1, 1,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

-- Demo 餐廳 分類
INSERT OR REPLACE INTO categories (
  id, restaurant_id, name, description, sort_order, is_active, item_count,
  created_at_ms, updated_at_ms
) VALUES
(13, '019469a0-0099-7000-8000-000000000099', '人氣推薦', '主廚精選的招牌料理', 1, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(14, '019469a0-0099-7000-8000-000000000099', '經典主食', '飽足感十足的主食料理', 2, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000),
(15, '019469a0-0099-7000-8000-000000000099', '輕食沙拉', '清爽健康的輕食選擇', 3, 1, 3, unixepoch('now') * 1000, unixepoch('now') * 1000),
(16, '019469a0-0099-7000-8000-000000000099', '飲品甜點', '精選飲料與手工甜點', 4, 1, 4, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- Demo 餐廳 菜單項目
INSERT OR REPLACE INTO menu_items (
  id, restaurant_id, category_id, name, description, ingredients,
  price, original_price, is_available, is_featured, is_popular,
  sort_order, spice_level, preparation_time, calories,
  dietary_info, options, order_count, rating, review_count,
  created_at_ms, updated_at_ms
) VALUES
-- 人氣推薦
(46, '019469a0-0099-7000-8000-000000000099', 13, '松露野菇燉飯', '使用義大利米搭配黑松露醬與三種菇類，濃郁奶香', '義大利米, 黑松露醬, 香菇, 杏鮑菇, 秀珍菇, 帕馬森起司',
  320, NULL, 1, 1, 1, 1, 0, 15, 580,
  '{"vegetarian":true}',
  '{"customizations":[{"id":"c1","name":"起司量","type":"single","required":false,"choices":[{"id":"ch1","name":"正常","isDefault":true},{"id":"ch2","name":"加倍起司","priceAdjustment":40}]}]}',
  892, 4.9, 156, unixepoch('now') * 1000, unixepoch('now') * 1000),

(47, '019469a0-0099-7000-8000-000000000099', 13, '泰式檸檬魚', '新鮮鱸魚搭配酸辣檸檬醬汁，泰式香料提味', '鱸魚, 檸檬, 辣椒, 香菜, 魚露, 蒜頭',
  380, NULL, 1, 1, 1, 2, 2, 20, 320,
  '{"glutenFree":true,"seafoodFree":false}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"不辣"},{"id":"ch2","name":"小辣","isDefault":true},{"id":"ch3","name":"中辣"},{"id":"ch4","name":"大辣"}]}]}',
  645, 4.8, 112, unixepoch('now') * 1000, unixepoch('now') * 1000),

(48, '019469a0-0099-7000-8000-000000000099', 13, '和牛漢堡排', '澳洲和牛手打漢堡排配特製醬汁與溫泉蛋', '和牛絞肉, 洋蔥, 溫泉蛋, 特製醬汁',
  350, 420, 1, 1, 1, 3, 0, 18, 720,
  '{}',
  '{"sizes":[{"id":"s1","name":"單排","priceAdjustment":0,"isDefault":true},{"id":"s2","name":"雙排","priceAdjustment":180}],"addOns":[{"id":"a1","name":"加溫泉蛋","price":30},{"id":"a2","name":"加起司片","price":25}]}',
  723, 4.7, 98, unixepoch('now') * 1000, unixepoch('now') * 1000),

(49, '019469a0-0099-7000-8000-000000000099', 13, '招牌雞翅拼盤', '三種風味一次滿足：蜂蜜芥末、韓式辣醬、蒜香奶油', '雞翅, 蜂蜜, 芥末, 韓式辣醬, 蒜頭, 奶油',
  280, NULL, 1, 0, 1, 4, 1, 12, 450,
  '{}', NULL,
  534, 4.6, 87, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 經典主食
(50, '019469a0-0099-7000-8000-000000000099', 14, '日式豚骨拉麵', '12小時熬製豚骨湯頭，自製叉燒與溏心蛋', '豚骨高湯, 拉麵, 叉燒, 溏心蛋, 蔥花, 海苔',
  220, NULL, 1, 0, 1, 1, 0, 12, 680,
  '{}',
  '{"customizations":[{"id":"c1","name":"湯頭濃度","type":"single","required":true,"choices":[{"id":"ch1","name":"清爽"},{"id":"ch2","name":"標準","isDefault":true},{"id":"ch3","name":"濃厚"}]},{"id":"c2","name":"麵條硬度","type":"single","required":true,"choices":[{"id":"ch1","name":"軟麵"},{"id":"ch2","name":"標準","isDefault":true},{"id":"ch3","name":"硬麵"},{"id":"ch4","name":"極硬"}]}],"addOns":[{"id":"a1","name":"加叉燒","price":50},{"id":"a2","name":"加溏心蛋","price":30}]}',
  967, 4.8, 178, unixepoch('now') * 1000, unixepoch('now') * 1000),

(51, '019469a0-0099-7000-8000-000000000099', 14, '綠咖哩椰汁雞', '正宗泰式綠咖哩配椰奶與嫩雞腿肉，附泰國香米', '雞腿肉, 綠咖哩醬, 椰奶, 茄子, 甜椒, 泰國香米',
  260, NULL, 1, 0, 1, 2, 2, 15, 550,
  '{"glutenFree":true}',
  '{"customizations":[{"id":"c1","name":"辣度","type":"single","required":true,"choices":[{"id":"ch1","name":"不辣"},{"id":"ch2","name":"小辣","isDefault":true},{"id":"ch3","name":"中辣"},{"id":"ch4","name":"大辣"}]}]}',
  456, 4.7, 76, unixepoch('now') * 1000, unixepoch('now') * 1000),

(52, '019469a0-0099-7000-8000-000000000099', 14, '炙燒鮭魚丼飯', '厚切鮭魚炙燒至微焦，搭配醋飯與味噌湯', '鮭魚, 壽司米, 海苔, 酪梨, 味噌湯',
  300, NULL, 1, 1, 0, 3, 0, 10, 520,
  '{"seafoodFree":false}',
  '{"sizes":[{"id":"s1","name":"標準","priceAdjustment":0,"isDefault":true},{"id":"s2","name":"大盛","priceAdjustment":60}]}',
  389, 4.9, 92, unixepoch('now') * 1000, unixepoch('now') * 1000),

(53, '019469a0-0099-7000-8000-000000000099', 14, '台式滷肉飯套餐', '古早味滷肉飯配滷蛋、燙青菜與貢丸湯', '五花肉, 紅蔥頭, 滷蛋, 時蔬, 貢丸, 白飯',
  160, NULL, 1, 0, 1, 4, 0, 8, 620,
  '{}',
  '{"sizes":[{"id":"s1","name":"小碗","priceAdjustment":0},{"id":"s2","name":"大碗","priceAdjustment":25,"isDefault":true}]}',
  1203, 4.8, 210, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 輕食沙拉
(54, '019469a0-0099-7000-8000-000000000099', 15, '凱薩雞肉沙拉', '嫩煎雞胸肉搭配羅曼生菜與自製凱薩醬', '雞胸肉, 羅曼生菜, 麵包丁, 帕馬森起司, 凱薩醬',
  220, NULL, 1, 0, 0, 1, 0, 8, 380,
  '{"glutenFree":false}',
  '{"addOns":[{"id":"a1","name":"加酪梨","price":40},{"id":"a2","name":"加半熟蛋","price":25}]}',
  312, 4.5, 54, unixepoch('now') * 1000, unixepoch('now') * 1000),

(55, '019469a0-0099-7000-8000-000000000099', 15, '鮮蝦酪梨捲', '大蝦仁搭配新鮮酪梨，紫蘇醋醬汁', '蝦仁, 酪梨, 小黃瓜, 紫蘇, 醋醬',
  260, NULL, 1, 0, 0, 2, 0, 10, 290,
  '{"glutenFree":true,"seafoodFree":false}', NULL,
  198, 4.6, 42, unixepoch('now') * 1000, unixepoch('now') * 1000),

(56, '019469a0-0099-7000-8000-000000000099', 15, '味噌豆腐溫沙拉', '嫩豆腐搭配時令蔬菜與溫熱味噌醬汁', '嫩豆腐, 菠菜, 玉米筍, 紅蘿蔔, 味噌醬',
  180, NULL, 1, 0, 0, 3, 0, 6, 210,
  '{"vegan":true,"vegetarian":true,"glutenFree":true}', NULL,
  167, 4.4, 31, unixepoch('now') * 1000, unixepoch('now') * 1000),

-- 飲品甜點
(57, '019469a0-0099-7000-8000-000000000099', 16, '抹茶拿鐵', '京都宇治抹茶搭配鮮奶，可選冰熱', '宇治抹茶粉, 鮮奶',
  140, NULL, 1, 0, 1, 1, 0, 3, 180,
  '{"vegetarian":true}',
  '{"customizations":[{"id":"c1","name":"溫度","type":"single","required":true,"choices":[{"id":"ch1","name":"熱","isDefault":true},{"id":"ch2","name":"冰"}]},{"id":"c2","name":"甜度","type":"single","required":true,"choices":[{"id":"ch1","name":"全糖"},{"id":"ch2","name":"半糖","isDefault":true},{"id":"ch3","name":"微糖"},{"id":"ch4","name":"無糖"}]}]}',
  876, 4.7, 134, unixepoch('now') * 1000, unixepoch('now') * 1000),

(58, '019469a0-0099-7000-8000-000000000099', 16, '百香果氣泡飲', '新鮮百香果搭配氣泡水，酸甜清爽', '百香果, 氣泡水, 蜂蜜',
  120, NULL, 1, 0, 0, 2, 0, 3, 90,
  '{"vegan":true}',
  '{"customizations":[{"id":"c1","name":"甜度","type":"single","required":false,"choices":[{"id":"ch1","name":"全糖"},{"id":"ch2","name":"半糖","isDefault":true},{"id":"ch3","name":"微糖"}]}]}',
  432, 4.5, 67, unixepoch('now') * 1000, unixepoch('now') * 1000),

(59, '019469a0-0099-7000-8000-000000000099', 16, '焦糖布丁', '法式經典焦糖烤布丁，滑嫩綿密', '雞蛋, 鮮奶, 砂糖, 香草莢',
  100, NULL, 1, 0, 1, 3, 0, 5, 250,
  '{"vegetarian":true,"glutenFree":true}', NULL,
  567, 4.8, 98, unixepoch('now') * 1000, unixepoch('now') * 1000),

(60, '019469a0-0099-7000-8000-000000000099', 16, '季節水果盤', '當季新鮮水果精選拼盤', '當季水果',
  150, NULL, 1, 0, 0, 4, 0, 3, 120,
  '{"vegan":true,"glutenFree":true}', NULL,
  234, 4.6, 45, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- ============================================================================
-- 驗證數據
-- ============================================================================
SELECT '✅ 餐廳數量:' as status, COUNT(*) as count FROM restaurants;
SELECT '✅ 用戶數量:' as status, COUNT(*) as count FROM users;
SELECT '✅ 分類數量:' as status, COUNT(*) as count FROM categories;
SELECT '✅ 菜單項目數量:' as status, COUNT(*) as count FROM menu_items;
SELECT '✅ 桌位數量:' as status, COUNT(*) as count FROM tables;
SELECT '✅ 顧客數量:' as status, COUNT(*) as count FROM customers;
SELECT '✅ 訂單數量:' as status, COUNT(*) as count FROM orders;
SELECT '✅ 訂單項目數量:' as status, COUNT(*) as count FROM order_items;

-- ============================================================================
-- 數據概覽
-- ============================================================================
SELECT '📋 餐廳列表:' as info;
SELECT id, name, type, category FROM restaurants;

SELECT '📋 各餐廳菜單數量:' as info;
SELECT r.name as restaurant, COUNT(m.id) as menu_count
FROM restaurants r
LEFT JOIN menu_items m ON r.id = m.restaurant_id
GROUP BY r.id;

SELECT '📋 訂單狀態分佈:' as info;
SELECT status, COUNT(*) as count FROM orders GROUP BY status;

-- ============================================================================
-- 使用說明
-- ============================================================================
--
-- 執行此腳本:
--
-- Local D1 Database (推薦):
-- $ pnpm run db:seed:mock
--
-- 或手動執行:
-- $ npx wrangler d1 execute makanmakan-local --local \
--   --file=./scripts/seed-mock-data.sql \
--   --config=./apps/api/wrangler.toml
--
-- 驗證數據:
-- $ npx wrangler d1 execute makanmakan-local --local \
--   --command="SELECT * FROM restaurants" \
--   --config=./apps/api/wrangler.toml
--
-- 測試帳號 (所有帳號密碼皆為 password123):
-- - 系統管理員: admin / password123
-- - 阿嬤的味道店主: grandmaShop / password123
-- - 櫻花亭店主: japanShop / password123
-- - 暹羅風味店主: thaiShop / password123
--
-- ============================================================================

-- ============================================================================
-- 訂位數據 (Reservations)
-- ============================================================================

INSERT OR REPLACE INTO reservations (
  id, restaurant_id, customer_name, customer_phone, customer_email,
  party_size, reservation_date, reservation_time, duration_minutes,
  table_id, special_requests, status, confirmation_code, notes,
  confirmed_at, arrived_at, seated_at, completed_at, cancelled_at, no_show_at,
  created_at, updated_at
) VALUES
-- 阿嬤的味道 — 各狀態測試數據
('rsv_pending_001', '019469a0-0001-7000-8000-000000000001',
 '林大明', '0912345678', 'ming@example.com',
 4, date('now', '+1 day'), '18:30', 90,
 NULL, '需要兒童座椅', 'pending', 'P12345', NULL,
 NULL, NULL, NULL, NULL, NULL, NULL,
 unixepoch('now') * 1000, unixepoch('now') * 1000),

('rsv_pending_002', '019469a0-0001-7000-8000-000000000001',
 '陳美玲', '0923456789', NULL,
 2, date('now', '+1 day'), '19:00', 60,
 NULL, NULL, 'pending', 'P12346', NULL,
 NULL, NULL, NULL, NULL, NULL, NULL,
 unixepoch('now') * 1000, unixepoch('now') * 1000),

('rsv_confirmed_001', '019469a0-0001-7000-8000-000000000001',
 '張小華', '0934567890', 'hua@example.com',
 6, date('now'), '12:00', 120,
 3, '慶生派對，需要蛋糕服務', 'confirmed', 'C12347', NULL,
 unixepoch('now') * 1000 - 86400000, NULL, NULL, NULL, NULL, NULL,
 unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000),

('rsv_arrived_001', '019469a0-0001-7000-8000-000000000001',
 '王志明', '0945678901', NULL,
 3, date('now'), '11:30', 90,
 1, '靠窗座位', 'arrived', 'A12348', NULL,
 unixepoch('now') * 1000 - 7200000, unixepoch('now') * 1000 - 600000, NULL, NULL, NULL, NULL,
 unixepoch('now') * 1000 - 86400000, unixepoch('now') * 1000),

('rsv_completed_001', '019469a0-0001-7000-8000-000000000001',
 '李淑芬', '0956789012', 'shufen@example.com',
 4, date('now', '-1 day'), '19:00', 90,
 2, NULL, 'completed', 'D12349', '用餐體驗良好',
 unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000 - 90000000,
 unixepoch('now') * 1000 - 89400000, unixepoch('now') * 1000 - 84000000, NULL, NULL,
 unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000),

('rsv_cancelled_001', '019469a0-0001-7000-8000-000000000001',
 '趙大偉', '0967890123', NULL,
 2, date('now', '+2 days'), '20:00', 60,
 NULL, NULL, 'cancelled', 'X12350', '客戶因故取消',
 unixepoch('now') * 1000 - 86400000, NULL, NULL, NULL,
 unixepoch('now') * 1000 - 3600000, NULL,
 unixepoch('now') * 1000 - 172800000, unixepoch('now') * 1000),

('rsv_noshow_001', '019469a0-0001-7000-8000-000000000001',
 '黃小琳', '0978901234', NULL,
 2, date('now', '-1 day'), '18:00', 60,
 NULL, NULL, 'no_show', 'N12351', '未到店，已致電無人接聽',
 unixepoch('now') * 1000 - 172800000, NULL, NULL, NULL, NULL,
 unixepoch('now') * 1000 - 86400000,
 unixepoch('now') * 1000 - 259200000, unixepoch('now') * 1000);

-- ============================================================================
-- 訂位時段 (Reservation Slots) — 今日 + 明日營業時段
-- ============================================================================

INSERT OR REPLACE INTO reservation_slots (
  id, restaurant_id, date, time_slot, max_capacity, max_tables,
  current_reservations, current_capacity, is_available, created_at, updated_at
) VALUES
-- 今日時段
('slot_today_1100', '019469a0-0001-7000-8000-000000000001', date('now'), '11:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1130', '019469a0-0001-7000-8000-000000000001', date('now'), '11:30', 20, 5, 1, 3, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1200', '019469a0-0001-7000-8000-000000000001', date('now'), '12:00', 20, 5, 1, 6, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1230', '019469a0-0001-7000-8000-000000000001', date('now'), '12:30', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1800', '019469a0-0001-7000-8000-000000000001', date('now'), '18:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1830', '019469a0-0001-7000-8000-000000000001', date('now'), '18:30', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1900', '019469a0-0001-7000-8000-000000000001', date('now'), '19:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_1930', '019469a0-0001-7000-8000-000000000001', date('now'), '19:30', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_today_2000', '019469a0-0001-7000-8000-000000000001', date('now'), '20:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
-- 明日時段
('slot_tmr_1100', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '11:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1130', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '11:30', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1200', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '12:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1800', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '18:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1830', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '18:30', 20, 5, 1, 4, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1900', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '19:00', 20, 5, 1, 2, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_1930', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '19:30', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000),
('slot_tmr_2000', '019469a0-0001-7000-8000-000000000001', date('now', '+1 day'), '20:00', 20, 5, 0, 0, 1, unixepoch('now') * 1000, unixepoch('now') * 1000);
