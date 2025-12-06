-- Legacy Timestamp Columns Cleanup Migration
-- Created: 2025-12-06
-- Purpose: 清理舊的 TEXT 時間戳欄位，完成 INTEGER 標準化遷移
--
-- 前置條件：
-- 1. Migration 0051 已成功執行
-- 2. 應用程式已更新為使用新欄位名 (*_new)
-- 3. 已驗證數據遷移正確無誤
--
-- 注意：此遷移會永久刪除舊欄位，執行前請確保備份！

-- ============================================================================
-- IMPORTANT: SQLite 不支援 DROP COLUMN
-- 需要重建表來移除欄位，這裡我們只創建索引和更新統計
-- 舊欄位將作為歷史記錄保留
-- ============================================================================

-- ============================================================================
-- STEP 1: 為新欄位創建索引（如果尚未存在）
-- ============================================================================

-- QR Codes 索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at_new ON qr_codes(created_at_new);

-- Coupons 索引
CREATE INDEX IF NOT EXISTS idx_coupons_created_at_new ON coupons(created_at_new);
CREATE INDEX IF NOT EXISTS idx_coupons_updated_at_new ON coupons(updated_at_new);

-- ============================================================================
-- STEP 2: 更新統計資訊
-- ============================================================================

ANALYZE qr_codes;
ANALYZE coupons;

-- ============================================================================
-- 使用說明
-- ============================================================================

-- 完成遷移後，應用程式應使用新欄位：
--
-- Schema 欄位對應：
--   舊欄位名          → 新欄位名
--   created_at        → created_at_new (INTEGER, Unix seconds)
--   updated_at        → updated_at_new (INTEGER, Unix seconds)
--   uploaded_at       → uploaded_at_new (INTEGER, Unix seconds)
--   viewed_at         → viewed_at_new (INTEGER, Unix seconds)
--   started_at        → started_at_new (INTEGER, Unix seconds)
--   completed_at      → completed_at_new (INTEGER, Unix seconds)
--   distributed_at    → distributed_at_new (INTEGER, Unix seconds)
--   expires_at        → expires_at_new (INTEGER, Unix seconds)
--   used_at           → used_at_new (INTEGER, Unix seconds)
--   downloaded_at     → downloaded_at_new (INTEGER, Unix seconds)
--
-- Drizzle Schema 已更新為：
--   createdAt → 指向 created_at_new
--   updatedAt → 指向 updated_at_new
--   等等...

-- ============================================================================
-- 後續清理（可選，需要重建表）
-- ============================================================================

-- 如果需要完全移除舊欄位，需要執行以下步驟：
-- 1. 創建新表（不包含舊欄位）
-- 2. 複製數據
-- 3. 刪除舊表
-- 4. 重命名新表
--
-- 示例（coupons 表）：
/*
CREATE TABLE coupons_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- ... 其他欄位 ...
  created_at INTEGER NOT NULL,  -- 新的 INTEGER 欄位
  updated_at INTEGER NOT NULL,  -- 新的 INTEGER 欄位
  deleted_at INTEGER
);

INSERT INTO coupons_new SELECT
  id, restaurant_id, code, name, ...,
  created_at_new, updated_at_new, deleted_at
FROM coupons;

DROP TABLE coupons;
ALTER TABLE coupons_new RENAME TO coupons;
*/

-- ============================================================================
-- 重要提醒
-- ============================================================================

-- 1. 舊欄位 (*_legacy) 暫時保留以確保向後兼容
-- 2. 新應用程式版本應只使用新欄位
-- 3. 待確認無問題後，可安排時間重建表以移除舊欄位
-- 4. 建議在低流量時段執行表重建操作
