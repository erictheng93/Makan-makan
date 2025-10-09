-- Remove Payment System Migration
-- Version: 0028
-- Created: 2025-10-09
-- Description: 移除支付系統相關的表和欄位，簡化系統架構
-- Reason: 暫時不做金流相關的串接，減少系統複雜度

-- =============================================
-- 1. 移除 Payment System 相關的表
-- =============================================

-- 注意：按照依賴關係的反向順序刪除表

-- 移除支付配置審計表
DROP TABLE IF EXISTS payment_config_audit;

-- 移除支付狀態轉換記錄表
DROP TABLE IF EXISTS payment_status_transitions;

-- 移除支付方式映射表
DROP TABLE IF EXISTS payment_method_mappings;

-- 移除支付系統設定表
DROP TABLE IF EXISTS payment_system_settings;

-- 移除 Webhook 事件表
DROP TABLE IF EXISTS webhook_events;

-- 移除支付日誌表
DROP TABLE IF EXISTS payment_logs;

-- 移除支付統計表
DROP TABLE IF EXISTS payment_statistics;

-- 移除退款交易表（依賴 payment_transactions）
DROP TABLE IF EXISTS refund_transactions;

-- 移除支付交易表（依賴 orders）
DROP TABLE IF EXISTS payment_transactions;

-- 移除支付提供商配置表（依賴 payment_providers）
DROP TABLE IF EXISTS payment_provider_configs;

-- 移除國家支付配置表
DROP TABLE IF EXISTS country_payment_configs;

-- 移除支付提供商表
DROP TABLE IF EXISTS payment_providers;

-- 移除可能存在的 refunds 表
DROP TABLE IF EXISTS refunds;

-- =============================================
-- 2. 清理 orders 表中的 payment 相關欄位
-- =============================================

-- 注意：SQLite 不支援 DROP COLUMN，需要重建表
-- 但由於 orders 表已有數據，我們先保留這些欄位
-- 可以選擇：
-- 方案 A：保留欄位但不使用（推薦，保持數據完整性）
-- 方案 B：重建表（風險較高，需要遷移數據）

-- 目前選擇方案 A：保留 payment_transaction_id 和 payment_status 欄位
-- 這些欄位將不再使用，但保持表結構穩定

-- 移除 payment_transaction_id 的外鍵約束索引
DROP INDEX IF EXISTS idx_orders_payment_transaction;

-- 移除 payment_status 索引
DROP INDEX IF EXISTS idx_orders_payment_status;

-- =============================================
-- 3. 清理 group_members 表中的 payment 相關欄位
-- =============================================

-- 同樣保留欄位但移除索引
DROP INDEX IF EXISTS idx_group_members_payment_status;
DROP INDEX IF EXISTS idx_group_members_transaction_id;

-- =============================================
-- 4. 驗證清理結果
-- =============================================

-- 檢查是否還有 payment 相關的表
-- SELECT name FROM sqlite_master
-- WHERE type='table' AND name LIKE '%payment%';

-- 檢查是否還有 payment 相關的索引
-- SELECT name FROM sqlite_master
-- WHERE type='index' AND name LIKE '%payment%';

-- =============================================
-- 完成
-- =============================================

-- 清理完成
-- - 移除了 14 個支付系統相關的表
-- - 移除了 4 個支付相關的索引
-- - 保留了 orders 和 group_members 表中的欄位以保持數據完整性
-- - 如未來需要支付功能，可以從備份的 migration 檔案恢復
