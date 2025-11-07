-- =====================================================
-- Migration: 為 restaurants 表新增 public_id (TEXT)
-- Version: 0039
-- Date: 2025-10-27
-- Description: 階段 1 - 新增 TEXT 類型的 public_id 欄位，為完整遷移做準備
-- =====================================================

-- 1. 為 restaurants 表新增 public_id 欄位
ALTER TABLE restaurants ADD COLUMN public_id TEXT;

-- 2. 為現有餐廳生成 public_id (基於建立時間)
-- 格式: S-YYYYMMDD-NNN
-- 範例: S-20251026-001

UPDATE restaurants
SET public_id = 'S-' ||
                strftime('%Y%m%d', datetime(created_at / 1000, 'unixepoch')) ||
                '-' ||
                printf('%03d', id)
WHERE public_id IS NULL;

-- 3. 建立唯一索引（確保不重複）
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_public_id ON restaurants(public_id);

-- 4. 驗證：確保所有餐廳都有 public_id
-- 這個查詢應該返回 0
-- SELECT COUNT(*) FROM restaurants WHERE public_id IS NULL;

-- 5. 添加註釋說明（SQLite 使用 comment 表記錄）
-- public_id 格式: S-YYYYMMDD-NNN
-- S = Shop/Store
-- YYYYMMDD = 建立日期
-- NNN = 當日序號 (001-999)
