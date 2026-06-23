-- Local development seed data.
--
-- DEV ONLY: this file creates known accounts with documented demo passwords.
-- It is intentionally used by the local-only `db:seed:local` script.

INSERT OR IGNORE INTO restaurants (
  id,
  name,
  type,
  category,
  description,
  address,
  district,
  city,
  phone,
  email,
  settings,
  is_available,
  is_active,
  created_at_ms,
  updated_at_ms
) VALUES (
  '019469a0-0099-7000-8000-000000000099',
  'MakanMakan Demo Restaurant',
  'demo',
  'general',
  'Local development restaurant for manual testing',
  '123 Food Street',
  'Demo District',
  'Taichung',
  '+886900000000',
  'demo@makanmakan.local',
  '{"currency":"TWD","language":"zh-Hant","timezone":"Asia/Taipei","allowGuestOrders":true}',
  1,
  1,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
);

INSERT OR IGNORE INTO users (
  id,
  username,
  password_hash,
  email,
  full_name,
  role,
  restaurant_id,
  is_active,
  is_verified,
  token_version,
  created_at_ms,
  updated_at_ms
) VALUES
  (
    '019469a1-0000-7000-8000-000000000001',
    'admin',
    '$2a$10$ERWg3wj4FrhL7ugtGMwflO7.uAcGpec9e.gRRV3.Nxcqr.EcVEEP2',
    'admin@makanmakan.local',
    'System Administrator',
    0,
    NULL,
    1,
    1,
    1,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  ),
  (
    '019469a1-0001-7000-8000-000000000002',
    'owner1',
    '$2a$10$WkTTAnK2XuDaViXuuTUJRewW8dy5J3s3MaOC2gukyJx3.9Hf43JM6',
    'owner1@makanmakan.local',
    'Restaurant Owner',
    1,
    '019469a0-0099-7000-8000-000000000099',
    1,
    1,
    1,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  );

UPDATE users
SET
  password_hash = CASE
    WHEN username = 'admin'
      THEN '$2a$10$ERWg3wj4FrhL7ugtGMwflO7.uAcGpec9e.gRRV3.Nxcqr.EcVEEP2'
    WHEN username = 'owner1'
      THEN '$2a$10$WkTTAnK2XuDaViXuuTUJRewW8dy5J3s3MaOC2gukyJx3.9Hf43JM6'
    ELSE password_hash
  END,
  updated_at_ms = unixepoch('now') * 1000
WHERE username IN ('admin', 'owner1');
