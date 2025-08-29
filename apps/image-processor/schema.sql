-- MakanMakan Image Processing Service Database Schema
-- Cloudflare D1 (SQLite) compatible

-- Images metadata table
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    variants TEXT NOT NULL DEFAULT '{}', -- JSON object with variant URLs
    uploaded_at TEXT NOT NULL,
    uploaded_by INTEGER, -- Reference to users.id
    restaurant_id INTEGER, -- Reference to restaurants.id, NULL for public images
    category TEXT DEFAULT 'general',
    tags TEXT, -- JSON array of tags
    alt_text TEXT,
    caption TEXT,
    exif_data TEXT, -- JSON object with EXIF data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Image processing jobs table
CREATE TABLE IF NOT EXISTS image_processing_jobs (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    transformations TEXT NOT NULL DEFAULT '[]', -- JSON array of transformations
    variants TEXT NOT NULL DEFAULT '[]', -- JSON array of variant names to generate
    progress INTEGER DEFAULT 0, -- 0-100
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Image views/access tracking table
CREATE TABLE IF NOT EXISTS image_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id TEXT NOT NULL,
    variant TEXT DEFAULT 'original',
    viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_images_restaurant_id ON images(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_images_category ON images(category);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_images_size ON images(size);
CREATE INDEX IF NOT EXISTS idx_images_mime_type ON images(mime_type);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_image_id ON image_processing_jobs(image_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON image_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON image_processing_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_image_views_image_id ON image_views(image_id);
CREATE INDEX IF NOT EXISTS idx_image_views_variant ON image_views(variant);
CREATE INDEX IF NOT EXISTS idx_image_views_viewed_at ON image_views(viewed_at);

-- Triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_images_timestamp 
AFTER UPDATE ON images
BEGIN
    UPDATE images SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_processing_jobs_timestamp 
AFTER UPDATE ON image_processing_jobs
BEGIN
    UPDATE image_processing_jobs SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Views for common queries

-- Image statistics view
CREATE VIEW IF NOT EXISTS image_stats AS
SELECT 
    COUNT(*) as total_images,
    SUM(size) as total_size,
    AVG(size) as avg_size,
    COUNT(DISTINCT restaurant_id) as restaurants_with_images,
    COUNT(DISTINCT category) as categories,
    COUNT(DISTINCT DATE(uploaded_at)) as active_days
FROM images;

-- Restaurant image summary view
CREATE VIEW IF NOT EXISTS restaurant_image_summary AS
SELECT 
    restaurant_id,
    COUNT(*) as image_count,
    SUM(size) as total_size,
    AVG(size) as avg_size,
    MAX(uploaded_at) as last_upload,
    COUNT(DISTINCT category) as categories_used
FROM images 
WHERE restaurant_id IS NOT NULL
GROUP BY restaurant_id;

-- Popular images view (by views in last 30 days)
CREATE VIEW IF NOT EXISTS popular_images AS
SELECT 
    i.id,
    i.filename,
    i.original_filename,
    i.category,
    i.restaurant_id,
    COUNT(v.id) as view_count,
    COUNT(DISTINCT DATE(v.viewed_at)) as unique_days_viewed
FROM images i
LEFT JOIN image_views v ON i.id = v.image_id 
WHERE v.viewed_at >= datetime('now', '-30 days')
GROUP BY i.id, i.filename, i.original_filename, i.category, i.restaurant_id
HAVING view_count > 0
ORDER BY view_count DESC;

-- Processing job summary view
CREATE VIEW IF NOT EXISTS job_summary AS
SELECT 
    status,
    COUNT(*) as job_count,
    AVG(
        CASE 
            WHEN completed_at IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(created_at)) * 24 * 60 * 60
            ELSE NULL 
        END
    ) as avg_processing_time_seconds
FROM image_processing_jobs
GROUP BY status;

-- Sample data for testing (optional)
-- Uncomment these lines if you want sample data for development

/*
INSERT OR IGNORE INTO images (
    id, filename, original_filename, mime_type, size, 
    variants, uploaded_at, category, alt_text
) VALUES 
(
    'sample-1', 
    'menu-item-1.jpg', 
    'delicious_noodles.jpg', 
    'image/jpeg', 
    152400,
    '{"thumbnail":"https://imagedelivery.net/abc/sample-1/thumbnail","medium":"https://imagedelivery.net/abc/sample-1/medium"}',
    datetime('now', '-1 day'),
    'menu',
    'Delicious stir-fried noodles'
),
(
    'sample-2', 
    'restaurant-interior.jpg', 
    'cozy_dining_room.jpg', 
    'image/jpeg', 
    234600,
    '{"thumbnail":"https://imagedelivery.net/abc/sample-2/thumbnail","large":"https://imagedelivery.net/abc/sample-2/large"}',
    datetime('now', '-2 hours'),
    'restaurant',
    'Cozy dining room interior'
);

INSERT OR IGNORE INTO image_views (image_id, variant) VALUES
('sample-1', 'thumbnail'),
('sample-1', 'medium'),
('sample-2', 'original'),
('sample-1', 'thumbnail');

INSERT OR IGNORE INTO image_processing_jobs (
    id, image_id, status, transformations, variants, completed_at
) VALUES 
(
    'job-1', 
    'sample-1', 
    'completed', 
    '[{"type":"resize","width":600,"height":400}]',
    '["thumbnail","medium","large"]',
    datetime('now', '-30 minutes')
);
*/

-- Performance optimization queries (for maintenance)

-- Query to find large images that might need optimization
-- SELECT id, filename, size, mime_type FROM images WHERE size > 5000000 ORDER BY size DESC;

-- Query to find unused images (no views in 90 days)
-- SELECT i.id, i.filename, i.uploaded_at FROM images i 
-- LEFT JOIN image_views v ON i.id = v.image_id 
-- WHERE v.id IS NULL OR MAX(v.viewed_at) < datetime('now', '-90 days')
-- GROUP BY i.id;

-- Query to find processing jobs that are stuck
-- SELECT * FROM image_processing_jobs 
-- WHERE status = 'processing' AND created_at < datetime('now', '-1 hour');