-- 臨時：手動遷移核心數據（users）
PRAGMA foreign_keys=OFF;

-- 遷移 users 數據
INSERT INTO users_new (
    id, username, email, phone, full_name, password, password_hash, role, restaurant_id,
    address, date_of_birth, profile_image_url, is_active, is_verified, preferences,
    total_orders, total_spent, last_login_at, password_changed_at, created_at, updated_at,
    password_migrated, migration_date
) SELECT
    u.id, u.username, u.email, u.phone, u.full_name, u.password, u.password_hash, u.role,
    CASE WHEN u.restaurant_id IS NOT NULL THEN r.public_id ELSE NULL END as restaurant_id,
    u.address, u.date_of_birth, u.profile_image_url, u.is_active, u.is_verified, u.preferences,
    u.total_orders, u.total_spent, u.last_login_at, u.password_changed_at, u.created_at, u.updated_at,
    u.password_migrated, u.migration_date
FROM users u
LEFT JOIN restaurants r ON u.restaurant_id = r.id;

PRAGMA foreign_keys=ON;
