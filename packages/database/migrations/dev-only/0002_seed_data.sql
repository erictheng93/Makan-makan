-- MakanMasak Database Migration: Seed Data (Simplified)
-- Created: 2025-10-11
-- Description: Minimal seed data for initial testing

-- 1. Insert sample restaurants
INSERT INTO restaurants (name, type, category, description, address, district, city, phone, email, settings, is_available, is_active, created_at, updated_at) VALUES
('MakanMasak Demo Restaurant', '中式', '綜合', 'A demonstration restaurant for testing', '123 Food Street', 'KL City', 'Kuala Lumpur', '+60123456789', 'demo@makanmasak.com', '{"currency":"MYR","language":"zh-CN","timezone":"Asia/Kuala_Lumpur"}', 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 2. Insert admin user
-- Password will be hashed by 0032_fix_admin_password migration
INSERT INTO users (username, password_hash, email, full_name, role, restaurant_id, is_active, created_at, updated_at) VALUES
('admin', 'admin123', 'admin@makanmasak.com', 'System Administrator', 0, NULL, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('owner1', 'owner123', 'owner1@example.com', 'Restaurant Owner', 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
