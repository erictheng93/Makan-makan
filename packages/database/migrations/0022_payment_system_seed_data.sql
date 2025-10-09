-- Payment System Seed Data Migration
-- Version: 0022
-- Created: 2025-09-07
-- Status: SKIPPED
-- Reason: 暫時不做金流相關的串接，未來需要時再啟用
--
-- 此遷移已被跳過，因為：
-- 1. 依賴於 0021_payment_system_infrastructure.sql
-- 2. 目前不需要支付提供商的種子數據
-- 3. 簡化系統架構
--
-- 原始遷移檔案已備份為：0022_payment_system_seed_data.sql.skip
-- 如需恢復，請參考備份檔案

-- 空白遷移 - 標記為已執行但不做任何變更
SELECT 1 WHERE 1=0;
