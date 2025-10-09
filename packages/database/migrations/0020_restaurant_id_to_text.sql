-- Restaurant ID Migration: INTEGER to TEXT
-- Created: 2025-09-07
-- Status: SKIPPED
-- Reason: 非必要的重大結構變更，當前 INTEGER restaurant_id 運作正常
--
-- 此遷移已被跳過，因為：
-- 1. 將 restaurant_id 從 INTEGER 改為 TEXT 是非必要的變更
-- 2. 當前系統使用 INTEGER restaurant_id 運作良好
-- 3. 這個變更需要大量的資料轉換，存在風險
-- 4. 如果未來需要，可以在新版本中重新實作
--
-- 原始遷移檔案已備份為：0020_restaurant_id_to_text.sql.skip

-- 空白遷移 - 標記為已執行但不做任何變更
SELECT 1 WHERE 1=0;
