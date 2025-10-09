-- Payment System Infrastructure Migration
-- Version: 0021
-- Created: 2025-09-07
-- Status: SKIPPED
-- Reason: 暫時不做金流相關的串接，未來需要時再啟用
--
-- 此遷移已被跳過，因為：
-- 1. 目前產品階段不需要複雜的多提供商支付系統
-- 2. 可以先使用簡單的現金/卡支付記錄
-- 3. 減少系統複雜度，專注核心功能開發
-- 4. 未來需要時可以重新啟用此 migration
--
-- 原始遷移檔案已備份為：0021_payment_system_infrastructure.sql.skip
-- 如需恢復，請參考備份檔案

-- 空白遷移 - 標記為已執行但不做任何變更
SELECT 1 WHERE 1=0;
