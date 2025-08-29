-- 從舊系統遷移到新 Drizzle 結構的 SQL 腳本
-- 注意：這個腳本需要在有舊資料的情況下執行

-- 1. 遷移餐廳資料 (shop_info -> restaurants)
INSERT INTO restaurants (
    id,
    name,
    type,
    category,
    address,
    district,
    city,
    phone,
    is_available,
    logo_url,
    created_at,
    updated_at
)
SELECT 
    shop_ID as id,
    shop_name as name,
    shop_type as type,
    shop_category as category,
    shop_adrress as address,
    shop_district as district,
    '台中市' as city,
    shop_hp as phone,
    shop_available as is_available,
    CASE 
        WHEN shop_logo != '' THEN '/images/restaurants/' || shop_logo
        ELSE NULL
    END as logo_url,
    datetime('now') as created_at,
    datetime('now') as updated_at
FROM shop_info
WHERE shop_ID IS NOT NULL;

-- 2. 創建預設分類對應表 (category -> categories)
INSERT INTO categories (
    id,
    restaurant_id,
    name,
    sort_order,
    is_active,
    is_visible,
    created_at,
    updated_at
)
SELECT 
    cat_id as id,
    1111 as restaurant_id, -- 假設第一個餐廳 ID
    category as name,
    cat_id as sort_order,
    1 as is_active,
    1 as is_visible,
    datetime('now') as created_at,
    datetime('now') as updated_at
FROM category;

-- 為每個餐廳複製分類
INSERT INTO categories (
    restaurant_id,
    name,
    sort_order,
    is_active,
    is_visible,
    created_at,
    updated_at
)
SELECT 
    r.id as restaurant_id,
    c.category as name,
    c.cat_id as sort_order,
    1 as is_active,
    1 as is_visible,
    datetime('now') as created_at,
    datetime('now') as updated_at
FROM restaurants r
CROSS JOIN category c
WHERE r.id != 1111; -- 排除已經添加的第一個餐廳

-- 3. 遷移菜單項目 (shop_menu -> menu_items)
INSERT INTO menu_items (
    id,
    restaurant_id,
    category_id,
    name,
    description,
    price,
    image_url,
    is_available,
    is_featured,
    spice_level,
    inventory_count,
    order_count,
    dietary_info,
    created_at,
    updated_at
)
SELECT 
    sm.menu_sn as id,
    sm.shop_ID as restaurant_id,
    -- 找到對應的新分類 ID
    (SELECT c.id FROM categories c 
     WHERE c.restaurant_id = sm.shop_ID 
     AND c.sort_order = sm.menu_category 
     LIMIT 1) as category_id,
    sm.menu_foodname as name,
    sm.menu_describe as description,
    sm.menu_price as price,
    CASE 
        WHEN sm.menu_pictures IS NOT NULL AND sm.menu_pictures != '' 
        THEN '/images/menu/' || sm.menu_pictures
        ELSE NULL
    END as image_url,
    sm.menu_available as is_available,
    sm.menu_recommended as is_featured,
    CASE 
        WHEN sm.menu_spices3 = 1 THEN 3
        WHEN sm.menu_spices2 = 1 THEN 2  
        WHEN sm.menu_spices1 = 1 THEN 1
        ELSE 0
    END as spice_level,
    NULL as inventory_count, -- 舊系統沒有庫存管理
    sm.menu_ordered as order_count,
    json_object(
        'vegetarian', CASE WHEN sm.menu_wholeveg = 1 OR sm.menu_eggveg = 1 OR sm.menu_milkveg = 1 OR sm.menu_eggmilkveg = 1 THEN true ELSE false END,
        'vegan', CASE WHEN sm.menu_wholeveg = 1 THEN true ELSE false END,
        'glutenFree', false,
        'halal', CASE WHEN sm.menu_nonveg = 0 THEN true ELSE false END
    ) as dietary_info,
    COALESCE(sm.menu_UploadedTime, datetime('now')) as created_at,
    datetime('now') as updated_at
FROM shop_menu sm
WHERE sm.shop_ID IS NOT NULL
AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = sm.shop_ID
);

-- 4. 遷移桌子資料 (shop_table -> tables)
INSERT INTO tables (
    id,
    restaurant_id,
    number,
    capacity,
    is_occupied,
    is_active,
    qr_code,
    created_at,
    updated_at
)
SELECT 
    st.st_sn as id,
    st.shop_ID as restaurant_id,
    st.st_tableNumber as number,
    4 as capacity, -- 預設 4 人桌
    CASE WHEN st.st_full = 1 THEN true ELSE false END as is_occupied,
    1 as is_active,
    -- 生成 QR Code 內容
    json_object(
        'restaurantId', st.shop_ID,
        'tableId', st.st_sn,
        'version', 1
    ) as qr_code,
    datetime('now') as created_at,
    datetime('now') as updated_at
FROM shop_table st
WHERE st.shop_ID IS NOT NULL
AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = st.shop_ID
);

-- 5. 遷移員工資料 (employee -> users) 
INSERT INTO users (
    id,
    username,
    full_name,
    password_hash,
    role,
    restaurant_id,
    address,
    phone,
    is_active,
    created_at,
    updated_at
)
SELECT 
    e.sol_sn as id,
    e.sol_id as username,
    e.sol_name as full_name,
    -- 注意：舊密碼需要重新加密，這裡先設置一個預設值
    '$2b$10$defaulthash' as password_hash,
    e.sol_status as role,
    e.shop_ID as restaurant_id,
    e.sol_adrress as address,
    e.sol_hp as phone,
    1 as is_active,
    datetime('now') as created_at,
    datetime('now') as updated_at
FROM employee e
WHERE e.shop_ID IS NOT NULL
AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = e.shop_ID
);

-- 6. 遷移訂單資料 (shop_order & shop_ordermenu -> orders & order_items)
-- 注意：由於舊系統的訂單結構較複雜，這裡只做基本遷移

INSERT INTO orders (
    id,
    restaurant_id,
    table_id,
    order_number,
    status,
    subtotal,
    total_amount,
    created_at,
    updated_at
)
SELECT 
    so.shopOrder_sn as id,
    CAST(so.shop_ID as INTEGER) as restaurant_id,
    -- 嘗試找到對應的桌子 ID
    (SELECT t.id FROM tables t 
     WHERE t.restaurant_id = CAST(so.shop_ID as INTEGER) 
     AND t.number = so.shopOrder_table 
     LIMIT 1) as table_id,
    so.shopOrderMenu_ID as order_number,
    'completed' as status, -- 假設舊訂單都已完成
    COALESCE(so.shopOrder_price, 0) as subtotal,
    COALESCE(so.shopOrder_price, 0) as total_amount,
    so.shopOrder_date as created_at,
    datetime('now') as updated_at
FROM shop_order so
WHERE so.shop_ID IS NOT NULL
AND so.shop_ID != ''
AND EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = CAST(so.shop_ID as INTEGER)
);

-- 7. 更新統計資訊
-- 更新餐廳總訂單數
UPDATE restaurants 
SET total_orders = (
    SELECT COUNT(*) 
    FROM orders o 
    WHERE o.restaurant_id = restaurants.id
);

-- 更新分類商品數量
UPDATE categories 
SET item_count = (
    SELECT COUNT(*) 
    FROM menu_items mi 
    WHERE mi.category_id = categories.id 
    AND mi.is_available = 1
);

-- 8. 創建索引（如果還沒有的話）
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category 
ON menu_items(restaurant_id, category_id, is_available);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
ON orders(restaurant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_number 
ON tables(restaurant_id, number);

-- 遷移完成提示
SELECT 
    'Migration completed. Statistics:' as message,
    (SELECT COUNT(*) FROM restaurants) as total_restaurants,
    (SELECT COUNT(*) FROM categories) as total_categories, 
    (SELECT COUNT(*) FROM menu_items) as total_menu_items,
    (SELECT COUNT(*) FROM tables) as total_tables,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM orders) as total_orders;