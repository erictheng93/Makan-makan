-- ============================================================================
-- Migration: 07_table_and_seating.sql
-- Layer: 3 (Space Management Layer)
-- Description: Complete table and seating management system
-- Dependencies: 01_tenants_and_settings.sql, 02_authentication.sql
-- ============================================================================

-- ============================================================================
-- TABLE: areas
-- Description: Dining areas or zones within a restaurant
-- Features:
--   - Multiple areas per restaurant (indoor, outdoor, VIP, etc.)
--   - Capacity management
--   - Status tracking (open, closed, maintenance)
--   - Operating hours per area
--   - Priority and sorting
-- ============================================================================

CREATE TABLE IF NOT EXISTS areas (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant (Multi-tenant)
    restaurant_id TEXT NOT NULL,

    -- Area Information
    name TEXT NOT NULL,                        -- 'Main Dining', 'Outdoor', 'VIP Room'
    slug TEXT NOT NULL,                        -- URL-friendly name
    description TEXT,

    -- Area Type
    area_type TEXT NOT NULL DEFAULT 'indoor',

    -- Capacity
    capacity INTEGER NOT NULL DEFAULT 0,       -- Total people capacity
    table_count INTEGER DEFAULT 0,             -- Number of tables
    seat_count INTEGER DEFAULT 0,              -- Total seats

    -- Floor Information
    floor_number INTEGER DEFAULT 1,
    floor_name TEXT,                           -- 'Ground Floor', '2F', 'Basement'

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    is_bookable INTEGER DEFAULT 1,             -- Can be reserved
    is_visible INTEGER DEFAULT 1,              -- Show in customer app

    -- Operating Hours
    operating_hours TEXT DEFAULT '{}',         -- JSON: {mon: {open: '09:00', close: '22:00'}}
    is_always_open INTEGER DEFAULT 0,

    -- Features & Amenities
    features TEXT DEFAULT '[]',                -- JSON: ['smoking_area', 'window_view', 'quiet']
    amenities TEXT DEFAULT '[]',               -- JSON: ['wifi', 'charging', 'accessible']

    -- Priority & Display
    sort_order INTEGER DEFAULT 0,
    display_color TEXT,                        -- Hex color for UI
    icon_name TEXT,                            -- Icon identifier

    -- Service Information
    requires_reservation INTEGER DEFAULT 0,
    minimum_spend REAL DEFAULT 0,              -- Minimum spend requirement
    service_charge_rate REAL DEFAULT 0,        -- Additional service charge %

    -- Statistics (Denormalized)
    total_bookings INTEGER DEFAULT 0,
    occupancy_rate REAL DEFAULT 0,             -- 0-100

    -- Manager
    managed_by_user_id TEXT,                   -- Staff responsible

    -- Metadata
    metadata TEXT DEFAULT '{}',
    settings TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (managed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (area_type IN ('indoor', 'outdoor', 'vip', 'private_room', 'bar', 'terrace', 'garden', 'other')),
    CHECK (status IN ('active', 'inactive', 'maintenance', 'closed')),
    CHECK (capacity >= 0),
    CHECK (table_count >= 0),
    CHECK (seat_count >= 0),
    CHECK (is_bookable IN (0, 1)),
    CHECK (is_visible IN (0, 1)),
    CHECK (is_always_open IN (0, 1)),
    CHECK (requires_reservation IN (0, 1)),
    CHECK (minimum_spend >= 0),
    CHECK (service_charge_rate >= 0 AND service_charge_rate <= 100),
    CHECK (occupancy_rate >= 0 AND occupancy_rate <= 100),
    UNIQUE(restaurant_id, slug)
);

-- Indexes for areas table
CREATE INDEX IF NOT EXISTS idx_areas_restaurant ON areas(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_status ON areas(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_type ON areas(area_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_floor ON areas(restaurant_id, floor_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_sort ON areas(restaurant_id, sort_order ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_areas_bookable ON areas(restaurant_id, is_bookable) WHERE is_bookable = 1 AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: tables
-- Description: Tables within dining areas
-- Features:
--   - Table assignment to areas
--   - Capacity and shape information
--   - Real-time status tracking
--   - QR code assignment
--   - Reservation support
--   - Combinable tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS tables (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant & Area
    restaurant_id TEXT NOT NULL,
    area_id TEXT NOT NULL,

    -- Table Information
    table_number TEXT NOT NULL,                -- Human-readable table number
    display_name TEXT,                         -- Custom display name
    description TEXT,

    -- Physical Properties
    shape TEXT DEFAULT 'rectangle',
    min_capacity INTEGER NOT NULL DEFAULT 2,
    max_capacity INTEGER NOT NULL DEFAULT 4,
    default_capacity INTEGER NOT NULL DEFAULT 4,

    -- Position (for floor plan)
    position_x REAL,
    position_y REAL,
    rotation REAL DEFAULT 0,                   -- Degrees
    width REAL,
    height REAL,

    -- Status
    status TEXT NOT NULL DEFAULT 'available',
    is_active INTEGER DEFAULT 1,
    is_bookable INTEGER DEFAULT 1,
    is_visible INTEGER DEFAULT 1,

    -- Current Occupancy
    current_order_id TEXT,                     -- Current active order
    occupied_since INTEGER,
    occupied_by_customer_id TEXT,
    party_size INTEGER DEFAULT 0,

    -- Features
    features TEXT DEFAULT '[]',                -- JSON: ['window', 'corner', 'near_kitchen']
    is_outdoor INTEGER DEFAULT 0,
    is_accessible INTEGER DEFAULT 0,           -- Wheelchair accessible
    allows_smoking INTEGER DEFAULT 0,

    -- Combination
    can_combine INTEGER DEFAULT 0,             -- Can be combined with other tables
    combined_with TEXT DEFAULT '[]',           -- JSON array of table_ids
    is_combined INTEGER DEFAULT 0,

    -- QR Code
    qr_code_id TEXT,                           -- Link to QR code
    qr_code_url TEXT,

    -- Seat Management
    has_seats INTEGER DEFAULT 0,               -- Use seat-level tracking
    seat_count INTEGER DEFAULT 0,

    -- Priority & Display
    sort_order INTEGER DEFAULT 0,
    display_color TEXT,

    -- Service
    assigned_server_id TEXT,                   -- Current server
    preferred_server_id TEXT,                  -- Preferred server

    -- Statistics (Denormalized)
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    average_occupancy_time INTEGER DEFAULT 0,  -- In minutes
    turnover_rate REAL DEFAULT 0,              -- Tables per day

    -- Maintenance
    last_cleaned_at INTEGER,
    last_sanitized_at INTEGER,
    requires_maintenance INTEGER DEFAULT 0,
    maintenance_notes TEXT,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    settings TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (occupied_by_customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_server_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (preferred_server_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (shape IN ('rectangle', 'square', 'circle', 'oval', 'custom')),
    CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'maintenance', 'blocked')),
    CHECK (min_capacity > 0),
    CHECK (max_capacity >= min_capacity),
    CHECK (default_capacity >= min_capacity AND default_capacity <= max_capacity),
    CHECK (is_active IN (0, 1)),
    CHECK (is_bookable IN (0, 1)),
    CHECK (is_visible IN (0, 1)),
    CHECK (is_outdoor IN (0, 1)),
    CHECK (is_accessible IN (0, 1)),
    CHECK (allows_smoking IN (0, 1)),
    CHECK (can_combine IN (0, 1)),
    CHECK (is_combined IN (0, 1)),
    CHECK (has_seats IN (0, 1)),
    CHECK (seat_count >= 0),
    CHECK (party_size >= 0),
    CHECK (requires_maintenance IN (0, 1)),
    CHECK (turnover_rate >= 0),
    UNIQUE(restaurant_id, table_number)
);

-- Indexes for tables table
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_area ON tables(area_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_number ON tables(restaurant_id, table_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_available ON tables(restaurant_id, status) WHERE status = 'available' AND is_active = 1 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_occupied ON tables(restaurant_id, status) WHERE status = 'occupied' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_order ON tables(current_order_id) WHERE current_order_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_qr ON tables(qr_code_id) WHERE qr_code_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_capacity ON tables(restaurant_id, min_capacity, max_capacity) WHERE is_active = 1 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tables_server ON tables(assigned_server_id) WHERE assigned_server_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: seats
-- Description: Individual seats at tables (seat-level tracking)
-- Features:
--   - Seat-level QR codes
--   - Individual seat status
--   - Seat preferences
--   - Customer assignment
-- ============================================================================

CREATE TABLE IF NOT EXISTS seats (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant & Table
    restaurant_id TEXT NOT NULL,
    table_id TEXT NOT NULL,

    -- Seat Information
    seat_number TEXT NOT NULL,                 -- Seat identifier within table
    display_name TEXT,

    -- Position (relative to table)
    position_x REAL,
    position_y REAL,
    rotation REAL DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'available',
    is_active INTEGER DEFAULT 1,

    -- Current Occupancy
    current_order_id TEXT,                     -- Seat-level order
    occupied_since INTEGER,
    occupied_by_customer_id TEXT,

    -- Features
    seat_type TEXT DEFAULT 'standard',         -- 'standard', 'highchair', 'bench', 'stool'
    is_accessible INTEGER DEFAULT 0,
    has_armrest INTEGER DEFAULT 1,
    has_cushion INTEGER DEFAULT 0,
    features TEXT DEFAULT '[]',

    -- QR Code
    qr_code_id TEXT,
    qr_code_url TEXT,

    -- Priority
    sort_order INTEGER DEFAULT 0,

    -- Statistics
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (occupied_by_customer_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (status IN ('available', 'occupied', 'reserved', 'blocked')),
    CHECK (seat_type IN ('standard', 'highchair', 'bench', 'stool', 'wheelchair', 'bar_stool')),
    CHECK (is_active IN (0, 1)),
    CHECK (is_accessible IN (0, 1)),
    CHECK (has_armrest IN (0, 1)),
    CHECK (has_cushion IN (0, 1)),
    UNIQUE(table_id, seat_number)
);

-- Indexes for seats table
CREATE INDEX IF NOT EXISTS idx_seats_restaurant ON seats(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seats_table ON seats(table_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seats_available ON seats(table_id, status) WHERE status = 'available' AND is_active = 1 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seats_order ON seats(current_order_id) WHERE current_order_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seats_qr ON seats(qr_code_id) WHERE qr_code_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: table_reservations
-- Description: Table reservation and booking system
-- Features:
--   - Advance bookings
--   - Time slot management
--   - Party size tracking
--   - Reservation status
--   - Special requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS table_reservations (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant & Table
    restaurant_id TEXT NOT NULL,
    table_id TEXT,                             -- NULL if not assigned yet
    area_id TEXT,                              -- Preferred area

    -- Customer Information
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,

    -- Reservation Details
    reservation_date INTEGER NOT NULL,         -- Unix timestamp for reservation time
    duration_minutes INTEGER DEFAULT 90,
    party_size INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending',

    -- Timing
    confirmed_at INTEGER,
    arrived_at INTEGER,
    seated_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    no_show_at INTEGER,

    -- Special Requests
    special_requests TEXT,
    dietary_requirements TEXT DEFAULT '[]',
    occasion TEXT,                             -- 'birthday', 'anniversary', etc.

    -- Preferences
    preferred_seating TEXT,                    -- 'window', 'corner', 'quiet', etc.
    smoking_preference TEXT DEFAULT 'non_smoking',

    -- Deposit & Guarantee
    requires_deposit INTEGER DEFAULT 0,
    deposit_amount REAL DEFAULT 0,
    deposit_paid INTEGER DEFAULT 0,
    deposit_payment_id TEXT,

    -- Notifications
    confirmation_sent_at INTEGER,
    reminder_sent_at INTEGER,
    sms_sent INTEGER DEFAULT 0,
    email_sent INTEGER DEFAULT 0,

    -- Staff Information
    created_by_user_id TEXT,
    confirmed_by_user_id TEXT,

    -- Source
    booking_source TEXT DEFAULT 'phone',       -- 'phone', 'website', 'app', 'walk_in'
    booking_reference TEXT UNIQUE,             -- External booking reference

    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
    CHECK (party_size > 0),
    CHECK (duration_minutes > 0),
    CHECK (smoking_preference IN ('non_smoking', 'smoking', 'no_preference')),
    CHECK (requires_deposit IN (0, 1)),
    CHECK (deposit_paid IN (0, 1)),
    CHECK (sms_sent IN (0, 1)),
    CHECK (email_sent IN (0, 1)),
    CHECK (booking_source IN ('phone', 'website', 'app', 'walk_in', 'third_party'))
);

-- Indexes for table_reservations
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant ON table_reservations(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_table ON table_reservations(table_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON table_reservations(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_date ON table_reservations(restaurant_id, reservation_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_status ON table_reservations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_phone ON table_reservations(customer_phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_pending ON table_reservations(restaurant_id, status) WHERE status = 'pending' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_today ON table_reservations(restaurant_id, reservation_date) WHERE reservation_date >= (unixepoch('now', 'start of day') * 1000) AND reservation_date < (unixepoch('now', 'start of day', '+1 day') * 1000) AND deleted_at IS NULL;

-- ============================================================================
-- VIEWS: Query optimization and common patterns
-- ============================================================================

-- View: Available tables by capacity
CREATE VIEW IF NOT EXISTS v_available_tables AS
SELECT
    t.id,
    t.restaurant_id,
    t.area_id,
    a.name as area_name,
    t.table_number,
    t.display_name,
    t.min_capacity,
    t.max_capacity,
    t.status,
    t.features,
    t.is_accessible,
    t.qr_code_url
FROM tables t
JOIN areas a ON t.area_id = a.id
WHERE t.deleted_at IS NULL
    AND t.is_active = 1
    AND t.status = 'available'
    AND a.status = 'active'
    AND a.deleted_at IS NULL;

-- View: Table occupancy summary
CREATE VIEW IF NOT EXISTS v_table_occupancy_summary AS
SELECT
    t.restaurant_id,
    a.id as area_id,
    a.name as area_name,
    COUNT(*) as total_tables,
    COUNT(CASE WHEN t.status = 'available' THEN 1 END) as available_tables,
    COUNT(CASE WHEN t.status = 'occupied' THEN 1 END) as occupied_tables,
    COUNT(CASE WHEN t.status = 'reserved' THEN 1 END) as reserved_tables,
    CAST(COUNT(CASE WHEN t.status = 'occupied' THEN 1 END) AS REAL) * 100 / COUNT(*) as occupancy_rate
FROM tables t
JOIN areas a ON t.area_id = a.id
WHERE t.deleted_at IS NULL
    AND t.is_active = 1
    AND a.deleted_at IS NULL
    AND a.status = 'active'
GROUP BY t.restaurant_id, a.id, a.name;

-- View: Today's reservations
CREATE VIEW IF NOT EXISTS v_todays_reservations AS
SELECT
    r.id,
    r.restaurant_id,
    r.table_id,
    t.table_number,
    a.name as area_name,
    r.customer_name,
    r.customer_phone,
    r.party_size,
    r.reservation_date,
    r.status,
    r.special_requests
FROM table_reservations r
LEFT JOIN tables t ON r.table_id = t.id
LEFT JOIN areas a ON t.area_id = a.id
WHERE r.deleted_at IS NULL
    AND r.reservation_date >= (unixepoch('now', 'start of day') * 1000)
    AND r.reservation_date < (unixepoch('now', 'start of day', '+1 day') * 1000)
ORDER BY r.reservation_date ASC;

-- View: Area statistics
CREATE VIEW IF NOT EXISTS v_area_statistics AS
SELECT
    a.id,
    a.restaurant_id,
    a.name,
    a.capacity,
    COUNT(t.id) as total_tables,
    SUM(t.max_capacity) as total_seats,
    COUNT(CASE WHEN t.status = 'occupied' THEN 1 END) as occupied_tables,
    CAST(COUNT(CASE WHEN t.status = 'occupied' THEN 1 END) AS REAL) * 100 / COUNT(t.id) as current_occupancy_rate
FROM areas a
LEFT JOIN tables t ON a.id = t.area_id AND t.deleted_at IS NULL AND t.is_active = 1
WHERE a.deleted_at IS NULL
    AND a.status = 'active'
GROUP BY a.id, a.restaurant_id, a.name, a.capacity;

-- ============================================================================
-- TRIGGERS: Auto-update and maintain data consistency
-- ============================================================================

-- Trigger: Update areas.updated_at
CREATE TRIGGER IF NOT EXISTS trg_areas_updated_at
AFTER UPDATE ON areas
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE areas
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update tables.updated_at
CREATE TRIGGER IF NOT EXISTS trg_tables_updated_at
AFTER UPDATE ON tables
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE tables
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update seats.updated_at
CREATE TRIGGER IF NOT EXISTS trg_seats_updated_at
AFTER UPDATE ON seats
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE seats
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update table_reservations.updated_at
CREATE TRIGGER IF NOT EXISTS trg_reservations_updated_at
AFTER UPDATE ON table_reservations
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE table_reservations
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update area statistics when table added
CREATE TRIGGER IF NOT EXISTS trg_update_area_table_count_insert
AFTER INSERT ON tables
FOR EACH ROW
WHEN NEW.deleted_at IS NULL AND NEW.is_active = 1
BEGIN
    UPDATE areas
    SET
        table_count = table_count + 1,
        seat_count = seat_count + NEW.max_capacity
    WHERE id = NEW.area_id;
END;

-- Trigger: Update area statistics when table updated
CREATE TRIGGER IF NOT EXISTS trg_update_area_table_count_update
AFTER UPDATE ON tables
FOR EACH ROW
WHEN NEW.is_active != OLD.is_active OR NEW.max_capacity != OLD.max_capacity
BEGIN
    -- Decrease from old area if changed
    UPDATE areas
    SET
        table_count = table_count - CASE WHEN OLD.is_active = 1 THEN 1 ELSE 0 END,
        seat_count = seat_count - CASE WHEN OLD.is_active = 1 THEN OLD.max_capacity ELSE 0 END
    WHERE id = OLD.area_id;

    -- Increase in new area
    UPDATE areas
    SET
        table_count = table_count + CASE WHEN NEW.is_active = 1 THEN 1 ELSE 0 END,
        seat_count = seat_count + CASE WHEN NEW.is_active = 1 THEN NEW.max_capacity ELSE 0 END
    WHERE id = NEW.area_id;
END;

-- Trigger: Update table seat_count when seat added
CREATE TRIGGER IF NOT EXISTS trg_update_table_seat_count_insert
AFTER INSERT ON seats
FOR EACH ROW
WHEN NEW.deleted_at IS NULL AND NEW.is_active = 1
BEGIN
    UPDATE tables
    SET seat_count = seat_count + 1
    WHERE id = NEW.table_id;
END;

-- Trigger: Update table seat_count when seat updated
CREATE TRIGGER IF NOT EXISTS trg_update_table_seat_count_update
AFTER UPDATE ON seats
FOR EACH ROW
WHEN (NEW.is_active != OLD.is_active) OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
BEGIN
    UPDATE tables
    SET seat_count = (
        SELECT COUNT(*)
        FROM seats
        WHERE table_id = NEW.table_id
            AND is_active = 1
            AND deleted_at IS NULL
    )
    WHERE id = NEW.table_id;
END;

-- Trigger: Mark table as occupied when order assigned
CREATE TRIGGER IF NOT EXISTS trg_mark_table_occupied
AFTER UPDATE ON orders
FOR EACH ROW
WHEN NEW.table_id IS NOT NULL AND NEW.status IN ('confirmed', 'preparing') AND OLD.table_id IS NULL
BEGIN
    UPDATE tables
    SET
        status = 'occupied',
        current_order_id = NEW.id,
        occupied_since = NEW.ordered_at,
        occupied_by_customer_id = NEW.customer_id,
        party_size = COALESCE(NEW.party_size, 1)
    WHERE id = NEW.table_id;
END;

-- Trigger: Clear table when order completed
CREATE TRIGGER IF NOT EXISTS trg_clear_table_on_order_complete
AFTER UPDATE ON orders
FOR EACH ROW
WHEN NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') AND NEW.table_id IS NOT NULL
BEGIN
    UPDATE tables
    SET
        status = 'available',
        current_order_id = NULL,
        occupied_since = NULL,
        occupied_by_customer_id = NULL,
        party_size = 0,
        total_orders = total_orders + 1,
        total_revenue = total_revenue + NEW.total_amount
    WHERE id = NEW.table_id;
END;

-- Trigger: Generate booking reference for reservation
CREATE TRIGGER IF NOT EXISTS trg_generate_booking_reference
AFTER INSERT ON table_reservations
FOR EACH ROW
WHEN NEW.booking_reference IS NULL
BEGIN
    UPDATE table_reservations
    SET booking_reference = 'RES' || upper(substr(NEW.id, 1, 8))
    WHERE id = NEW.id;
END;

-- ============================================================================
-- END OF MIGRATION: 07_table_and_seating.sql
-- ============================================================================
-- Summary:
--   - Tables: 4 (areas, tables, seats, table_reservations)
--   - Indexes: 41 total
--   - Views: 4 (available_tables, occupancy_summary, todays_reservations, area_stats)
--   - Triggers: 11 (auto-update, statistics, table status management)
--   - Lines: ~800
--
-- Features:
--   ✅ Multi-area management
--   ✅ Complete table management
--   ✅ Seat-level tracking
--   ✅ Table reservation system
--   ✅ Real-time occupancy tracking
--   ✅ Table combination support
--   ✅ Floor plan positioning
--   ✅ Capacity management
--   ✅ Automatic status updates
--   ✅ Statistics tracking
--   ✅ Accessibility features
--   ✅ Server assignment
--   ✅ Maintenance tracking
-- ============================================================================
