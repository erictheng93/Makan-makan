-- Timestamp Standardization Migration
-- Created: 2025-12-06
-- Purpose: 將 TEXT ISO 格式時間戳統一為 INTEGER (Unix seconds)
--
-- 受影響的表：
-- 1. images (uploadedAt, updatedAt)
-- 2. image_views (viewedAt)
-- 3. image_processing_jobs (createdAt, startedAt, completedAt)
-- 4. qr_codes (createdAt)
-- 5. qr_templates (createdAt, updatedAt)
-- 6. qr_downloads (downloadedAt)
-- 7. qr_batches (createdAt, completedAt)
-- 8. coupons (validFrom, validTo, createdAt, updatedAt)
-- 9. coupon_usage (usedAt, createdAt, updatedAt)
-- 10. coupon_distributions (distributedAt, expiresAt, createdAt)
-- 11. coupon_templates (createdAt, updatedAt)

-- ============================================================================
-- 重要說明：SQLite 不支援直接修改列類型
-- 因此使用新增列 + 數據遷移 + 重命名的策略
-- ============================================================================

-- ============================================================================
-- STEP 1: IMAGES 表
-- ============================================================================

-- 新增 INTEGER 時間戳列
ALTER TABLE images ADD COLUMN uploaded_at_new INTEGER;
ALTER TABLE images ADD COLUMN updated_at_new INTEGER;

-- 遷移數據（TEXT ISO → INTEGER Unix seconds）
UPDATE images SET uploaded_at_new = CAST(strftime('%s', uploaded_at) AS INTEGER) WHERE uploaded_at IS NOT NULL;
UPDATE images SET updated_at_new = CAST(strftime('%s', updated_at) AS INTEGER) WHERE updated_at IS NOT NULL;

-- 設置默認值
UPDATE images SET uploaded_at_new = CAST(strftime('%s', 'now') AS INTEGER) WHERE uploaded_at_new IS NULL;
UPDATE images SET updated_at_new = CAST(strftime('%s', 'now') AS INTEGER) WHERE updated_at_new IS NULL;

-- ============================================================================
-- STEP 2: IMAGE_VIEWS 表
-- ============================================================================

ALTER TABLE image_views ADD COLUMN viewed_at_new INTEGER;
UPDATE image_views SET viewed_at_new = CAST(strftime('%s', viewed_at) AS INTEGER) WHERE viewed_at IS NOT NULL;

-- ============================================================================
-- STEP 3: IMAGE_PROCESSING_JOBS 表
-- ============================================================================

ALTER TABLE image_processing_jobs ADD COLUMN created_at_new INTEGER;
ALTER TABLE image_processing_jobs ADD COLUMN started_at_new INTEGER;
ALTER TABLE image_processing_jobs ADD COLUMN completed_at_new INTEGER;

UPDATE image_processing_jobs SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE image_processing_jobs SET started_at_new = CAST(strftime('%s', started_at) AS INTEGER) WHERE started_at IS NOT NULL;
UPDATE image_processing_jobs SET completed_at_new = CAST(strftime('%s', completed_at) AS INTEGER) WHERE completed_at IS NOT NULL;

-- ============================================================================
-- STEP 4: QR_CODES 表
-- ============================================================================

ALTER TABLE qr_codes ADD COLUMN created_at_new INTEGER;
UPDATE qr_codes SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE qr_codes SET created_at_new = CAST(strftime('%s', 'now') AS INTEGER) WHERE created_at_new IS NULL;

-- ============================================================================
-- STEP 5: QR_TEMPLATES 表
-- ============================================================================

ALTER TABLE qr_templates ADD COLUMN created_at_new INTEGER;
ALTER TABLE qr_templates ADD COLUMN updated_at_new INTEGER;

UPDATE qr_templates SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE qr_templates SET updated_at_new = CAST(strftime('%s', updated_at) AS INTEGER) WHERE updated_at IS NOT NULL;

-- ============================================================================
-- STEP 6: QR_DOWNLOADS 表
-- ============================================================================

ALTER TABLE qr_downloads ADD COLUMN downloaded_at_new INTEGER;
UPDATE qr_downloads SET downloaded_at_new = CAST(strftime('%s', downloaded_at) AS INTEGER) WHERE downloaded_at IS NOT NULL;

-- ============================================================================
-- STEP 7: QR_BATCHES 表
-- ============================================================================

ALTER TABLE qr_batches ADD COLUMN created_at_new INTEGER;
ALTER TABLE qr_batches ADD COLUMN completed_at_new INTEGER;

UPDATE qr_batches SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE qr_batches SET completed_at_new = CAST(strftime('%s', completed_at) AS INTEGER) WHERE completed_at IS NOT NULL;

-- ============================================================================
-- STEP 8: COUPONS 表
-- ============================================================================

-- 有效期仍保持 TEXT 格式（YYYY-MM-DD 日期格式更易讀）
-- 只遷移 createdAt 和 updatedAt

ALTER TABLE coupons ADD COLUMN created_at_new INTEGER;
ALTER TABLE coupons ADD COLUMN updated_at_new INTEGER;

UPDATE coupons SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE coupons SET updated_at_new = CAST(strftime('%s', updated_at) AS INTEGER) WHERE updated_at IS NOT NULL;
UPDATE coupons SET created_at_new = CAST(strftime('%s', 'now') AS INTEGER) WHERE created_at_new IS NULL;
UPDATE coupons SET updated_at_new = CAST(strftime('%s', 'now') AS INTEGER) WHERE updated_at_new IS NULL;

-- ============================================================================
-- STEP 9: COUPON_USAGE 表
-- ============================================================================

ALTER TABLE coupon_usage ADD COLUMN used_at_new INTEGER;
ALTER TABLE coupon_usage ADD COLUMN created_at_new INTEGER;
ALTER TABLE coupon_usage ADD COLUMN updated_at_new INTEGER;

UPDATE coupon_usage SET used_at_new = CAST(strftime('%s', used_at) AS INTEGER) WHERE used_at IS NOT NULL;
UPDATE coupon_usage SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE coupon_usage SET updated_at_new = CAST(strftime('%s', updated_at) AS INTEGER) WHERE updated_at IS NOT NULL;

-- ============================================================================
-- STEP 10: COUPON_DISTRIBUTIONS 表
-- ============================================================================

ALTER TABLE coupon_distributions ADD COLUMN distributed_at_new INTEGER;
ALTER TABLE coupon_distributions ADD COLUMN expires_at_new INTEGER;
ALTER TABLE coupon_distributions ADD COLUMN created_at_new INTEGER;

UPDATE coupon_distributions SET distributed_at_new = CAST(strftime('%s', distributed_at) AS INTEGER) WHERE distributed_at IS NOT NULL;
UPDATE coupon_distributions SET expires_at_new = CAST(strftime('%s', expires_at) AS INTEGER) WHERE expires_at IS NOT NULL;
UPDATE coupon_distributions SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;

-- ============================================================================
-- STEP 11: COUPON_TEMPLATES 表
-- ============================================================================

ALTER TABLE coupon_templates ADD COLUMN created_at_new INTEGER;
ALTER TABLE coupon_templates ADD COLUMN updated_at_new INTEGER;

UPDATE coupon_templates SET created_at_new = CAST(strftime('%s', created_at) AS INTEGER) WHERE created_at IS NOT NULL;
UPDATE coupon_templates SET updated_at_new = CAST(strftime('%s', updated_at) AS INTEGER) WHERE updated_at IS NOT NULL;

-- ============================================================================
-- 索引優化
-- ============================================================================

-- Images
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at_new);

-- QR Codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at ON qr_codes(created_at_new);

-- Coupons
CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON coupons(created_at_new);

-- Coupon Usage
CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at_new);

-- ============================================================================
-- 使用說明
-- ============================================================================

-- 完成遷移後，應用程式應使用 _new 欄位：
--
-- 查詢範例：
-- SELECT * FROM images WHERE uploaded_at_new > 1701820800
--
-- 插入範例：
-- INSERT INTO images (..., uploaded_at_new) VALUES (..., unixepoch())
--
-- 後續步驟（需要應用停機）：
-- 1. 確認所有數據已遷移
-- 2. 刪除舊的 TEXT 欄位
-- 3. 重命名 _new 欄位為原名
-- 4. 更新 Drizzle schema 以匹配

-- ============================================================================
-- 注意事項
-- ============================================================================

-- 1. partnerships 表已使用 timestamp_ms（毫秒），保持不變
-- 2. validFrom/validTo 保持 TEXT 格式（日期字串更易讀）
-- 3. 本遷移創建 _new 欄位，需後續清理舊欄位
