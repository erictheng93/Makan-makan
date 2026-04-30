/**
 * Extended Test App for Integration Tests
 *
 * Builds on top of the existing test-utils.ts infrastructure:
 * - Uses createTestDB() for SharedDataStore + D1 mock
 * - Mounts ALL production routes (not just the 13 in createTestApp)
 * - Creates additional tables missing from SharedDataStore
 * - Provides auth token helpers
 */

import { Hono } from "hono";
import type { Env } from "../../../types/env";
import { vi } from "vitest";
import {
  createTestDB,
  generateTestToken,
  type TestDB,
} from "../../helpers/test-utils";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

// ─── Feature Imports ────────────────────────────────────────────────────────
// Matching production index.ts imports exactly

import restaurantsFeature from "../../../features/restaurants";
import authFeature from "../../../features/authentication";
import menuFeature from "../../../features/menu";
import { default as kitchenFeature } from "../../../features/kitchen";
import ordersFeature from "../../../features/orders";
import groupOrdersFeature from "../../../features/group-orders";
import posFeature from "../../../features/pos";
import queueFeature from "../../../features/queue";
import tablesFeature from "../../../features/tables";
import usersFeature from "../../../features/users";
import analyticsFeature from "../../../features/analytics";
import qrCodesFeature from "../../../features/qr-codes";
import couponsFeature from "../../../features/coupons";
import seatsFeature from "../../../features/seats";
import customersRouter from "../../../features/customers/routes";
import waitingListFeature from "../../../features/waiting-list";
import partnershipsRoutes from "../../../features/partnerships/routes";
import integrationsFeature from "../../../features/integrations";
import reservationsFeature from "../../../features/reservations";
import notificationsRoutes from "../../../features/notifications/routes";
import guestOrdersRoutes from "../../../features/guest-orders";
import verificationFeature from "../../../features/verification";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IntegrationTestApp {
  app: Hono<{ Bindings: Env }>;
  db: TestDB;
  dataStore: any; // SharedDataStore
  authHelper: AuthHelper;
}

export interface AuthHelper {
  adminToken: (restaurantId?: string | number) => string;
  ownerToken: (userId: number, restaurantId: string | number) => string;
  staffToken: (
    userId: number,
    role: number,
    restaurantId: string | number,
  ) => string;
  customerToken: (userId: number) => string;
}

// ─── Additional Table DDL ───────────────────────────────────────────────────

const ADDITIONAL_TABLES_DDL = [
  // Coupons — column names match MockDrizzle camelCase→snake_case mapping
  // from the Drizzle schema in packages/database/src/schema/coupons.ts
  `CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value REAL NOT NULL,
    max_discount_amount REAL,
    min_order_amount REAL DEFAULT 0,
    applicable_menu_items TEXT,
    applicable_categories TEXT,
    usage_limit INTEGER,
    usage_limit_per_user INTEGER,
    used_count INTEGER DEFAULT 0,
    valid_from TEXT NOT NULL DEFAULT '',
    valid_to TEXT NOT NULL DEFAULT '',
    is_active INTEGER DEFAULT 1,
    is_visible INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    created_by INTEGER,
    deleted_at TEXT
  )`,

  // Coupon Usage — column names match MockDrizzle camelCase→snake_case mapping
  `CREATE TABLE IF NOT EXISTS coupon_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    user_id INTEGER,
    discount_amount REAL NOT NULL,
    original_amount REAL NOT NULL,
    final_amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    used_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,

  // Platform Integrations
  `CREATE TABLE IF NOT EXISTS platform_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    store_id TEXT,
    is_enabled INTEGER DEFAULT 0,
    config TEXT,
    credentials TEXT,
    menu_sync_status TEXT DEFAULT 'pending',
    last_synced_at INTEGER,
    webhook_secret TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS platform_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    external_order_id TEXT NOT NULL,
    internal_order_id INTEGER,
    status TEXT DEFAULT 'pending',
    raw_data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS platform_webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT,
    platform TEXT NOT NULL,
    event_type TEXT,
    payload TEXT,
    status TEXT DEFAULT 'received',
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS platform_menu_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    external_item_id TEXT NOT NULL,
    internal_item_id INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Partnerships — column names must match the Drizzle schema in
  // packages/database/src/schema/partnerships/partnerships.ts exactly.
  // id is TEXT (UUID), timestamps are INTEGER ms (created_at_ms / updated_at_ms),
  // contract dates are INTEGER ms (contract_start_date_ms / contract_end_date_ms).
  `CREATE TABLE IF NOT EXISTS partnerships (
    id TEXT PRIMARY KEY,
    partner_code TEXT NOT NULL UNIQUE,
    partner_name TEXT NOT NULL,
    partner_name_en TEXT,
    partner_type TEXT NOT NULL,
    contact_person TEXT NOT NULL DEFAULT '',
    contact_title TEXT,
    contact_phone TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    address TEXT,
    contract_number TEXT UNIQUE,
    contract_start_date_ms INTEGER NOT NULL DEFAULT 0,
    contract_end_date_ms INTEGER NOT NULL DEFAULT 0,
    contract_document_url TEXT,
    verification_method TEXT NOT NULL DEFAULT 'manual',
    verification_config TEXT DEFAULT '{}',
    allowed_email_domains TEXT DEFAULT '[]',
    default_discount_type TEXT,
    default_discount_value REAL,
    total_verified_members INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    total_discount_given REAL DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    is_active INTEGER DEFAULT 1,
    logo_url TEXT,
    description TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    created_at_ms INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER NOT NULL DEFAULT 0,
    deleted_at_ms INTEGER,
    created_by INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`,

  // partnership_plans — must match packages/database/src/schema/partnerships/plans.ts
  `CREATE TABLE IF NOT EXISTS partnership_plans (
    id TEXT PRIMARY KEY,
    partnership_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL DEFAULT '',
    plan_code TEXT NOT NULL DEFAULT '',
    plan_name TEXT NOT NULL DEFAULT '',
    plan_name_en TEXT,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value REAL NOT NULL DEFAULT 0,
    max_discount_amount REAL,
    min_order_amount REAL DEFAULT 0,
    max_order_amount REAL,
    applicable_menu_items TEXT DEFAULT '[]',
    applicable_categories TEXT DEFAULT '[]',
    excluded_menu_items TEXT DEFAULT '[]',
    excluded_categories TEXT DEFAULT '[]',
    applicable_days TEXT DEFAULT '[]',
    applicable_time_slots TEXT DEFAULT '[]',
    usage_limit_per_member INTEGER,
    usage_limit_per_day INTEGER,
    daily_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    valid_from_ms INTEGER NOT NULL DEFAULT 0,
    valid_to_ms INTEGER NOT NULL DEFAULT 0,
    priority INTEGER DEFAULT 0,
    can_combine_with_coupons INTEGER DEFAULT 0,
    can_combine_with_promotions INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    badge_text TEXT,
    badge_color TEXT,
    show_on_menu INTEGER DEFAULT 1,
    total_discount_given REAL DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    terms_and_conditions TEXT,
    notes TEXT,
    metadata TEXT DEFAULT '{}',
    created_at_ms INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER NOT NULL DEFAULT 0,
    deleted_at_ms INTEGER,
    created_by INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`,

  // verified_members — must match packages/database/src/schema/partnerships/members.ts
  `CREATE TABLE IF NOT EXISTS verified_members (
    id TEXT PRIMARY KEY,
    partnership_id TEXT NOT NULL,
    customer_id INTEGER,
    user_id INTEGER,
    email TEXT,
    member_type TEXT DEFAULT 'other',
    member_id_number TEXT,
    verification_code TEXT,
    verification_method TEXT DEFAULT 'manual',
    verified_at_ms INTEGER,
    expires_at_ms INTEGER,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    metadata TEXT DEFAULT '{}',
    created_at_ms INTEGER NOT NULL DEFAULT 0,
    updated_at_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`,

  // Waiting List (different from waiting_queue)
  `CREATE TABLE IF NOT EXISTS waiting_list (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    queue_number INTEGER NOT NULL,
    queue_letter TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL DEFAULT 1,
    special_requests TEXT,
    priority INTEGER DEFAULT 0,
    estimated_wait_minutes INTEGER,
    table_preferences TEXT,
    assigned_table_id INTEGER,
    status TEXT NOT NULL DEFAULT 'waiting',
    notification_methods TEXT,
    notification_count INTEGER DEFAULT 0,
    check_in_code TEXT,
    joined_at INTEGER,
    called_at INTEGER,
    confirmed_at INTEGER,
    seated_at INTEGER,
    cancelled_at INTEGER,
    timeout_at INTEGER,
    no_show_at INTEGER,
    served_by INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Reservations
  `CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    party_size INTEGER NOT NULL DEFAULT 2,
    reservation_date TEXT NOT NULL,
    reservation_time TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 90,
    table_id INTEGER,
    confirmation_code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    special_requests TEXT,
    notes TEXT,
    reminded_at INTEGER,
    confirmed_at INTEGER,
    arrived_at INTEGER,
    seated_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    cancellation_reason TEXT,
    no_show_at INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS reservation_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 10,
    booked_count INTEGER NOT NULL DEFAULT 0,
    is_available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Queue notifications (if not exists)
  `CREATE TABLE IF NOT EXISTS queue_notifications (
    id TEXT PRIMARY KEY,
    queue_id TEXT,
    notification_type TEXT NOT NULL,
    recipient TEXT,
    message_template TEXT,
    message_content TEXT,
    created_at TEXT NOT NULL
  )`,

  // Customers table (alias for customer-specific queries)
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    restaurant_id TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    visit_count INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    last_visit_at INTEGER,
    preferences TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // POS — Cash Registers
  `CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    restaurant_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    current_shift_id TEXT,
    hardware_config TEXT NOT NULL DEFAULT '{}',
    peripherals TEXT NOT NULL DEFAULT '{}',
    settings TEXT NOT NULL DEFAULT '{}',
    last_maintenance_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
  )`,

  // POS — Cash Shifts
  `CREATE TABLE IF NOT EXISTS cash_shifts (
    id TEXT PRIMARY KEY,
    register_id TEXT NOT NULL,
    operator_id INTEGER NOT NULL,
    start_amount REAL NOT NULL,
    end_amount REAL,
    expected_amount REAL NOT NULL,
    actual_amount REAL,
    difference_amount REAL NOT NULL DEFAULT 0,
    total_sales REAL NOT NULL DEFAULT 0,
    total_refunds REAL NOT NULL DEFAULT 0,
    cash_sales REAL NOT NULL DEFAULT 0,
    card_sales REAL NOT NULL DEFAULT 0,
    digital_sales REAL NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    started_at_ms INTEGER NOT NULL,
    ended_at_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    closing_notes TEXT
  )`,

  // POS — Cash Movements
  `CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    register_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    reference_id INTEGER,
    reference_type TEXT,
    payment_method TEXT,
    denomination_breakdown TEXT NOT NULL DEFAULT '{}',
    recorded_by INTEGER NOT NULL,
    approved_by INTEGER,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    receipt_number TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at_ms INTEGER NOT NULL
  )`,

  // POS — Receipts
  `CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    order_id INTEGER NOT NULL,
    register_id TEXT NOT NULL,
    shift_id TEXT,
    receipt_number TEXT NOT NULL UNIQUE,
    receipt_type TEXT NOT NULL,
    template_name TEXT NOT NULL DEFAULT 'standard',
    content TEXT NOT NULL,
    raw_content TEXT,
    print_status TEXT NOT NULL DEFAULT 'pending',
    print_attempts INTEGER NOT NULL DEFAULT 0,
    printer_name TEXT,
    printer_response TEXT,
    printed_at_ms INTEGER,
    reprinted_count INTEGER NOT NULL DEFAULT 0,
    last_reprint_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL
  )`,

  // POS — Refunds
  `CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    original_order_id INTEGER NOT NULL,
    register_id TEXT NOT NULL,
    shift_id TEXT,
    refund_number TEXT NOT NULL UNIQUE,
    refund_type TEXT NOT NULL,
    original_amount REAL NOT NULL,
    refund_amount REAL NOT NULL,
    refund_method TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    reason_description TEXT,
    items_refunded TEXT NOT NULL DEFAULT '[]',
    processed_by INTEGER NOT NULL,
    approved_by INTEGER,
    customer_signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    processed_at_ms INTEGER,
    completed_at_ms INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,

  // POS — Shift Reports
  `CREATE TABLE IF NOT EXISTS shift_reports (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    register_id TEXT NOT NULL,
    operator_id INTEGER NOT NULL,
    report_data TEXT NOT NULL,
    summary_data TEXT NOT NULL,
    generated_at_ms INTEGER NOT NULL
  )`,
];

// ─── App Creation ───────────────────────────────────────────────────────────

export async function createIntegrationTestApp(): Promise<IntegrationTestApp> {
  // 1. Create DB with SharedDataStore (reusing existing infrastructure)
  const db = await createTestDB();
  const dataStore = (
    db as {
      dataStore?: {
        getDB(): {
          run(sql: string): void;
        };
      };
    }
  ).dataStore;

  if (!dataStore) {
    throw new Error(
      "createTestDB() did not attach dataStore. Check test-utils.ts.",
    );
  }

  // 2. Create additional tables
  for (const ddl of ADDITIONAL_TABLES_DDL) {
    try {
      dataStore.getDB().run(ddl);
    } catch (e: unknown) {
      // Table might already exist, that's fine
      const message = e instanceof Error ? e.message : String(e);
      if (!message.includes("already exists")) {
        console.warn(`[ExtendedTestApp] DDL warning: ${message}`);
      }
    }
  }

  // 3. Build the Hono app
  const app = new Hono<{ Bindings: Env }>();

  // Error handler matching production
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as never,
      );
    }
    const sanitized = ErrorSanitizer.sanitizeError(err);
    const STATUS_MAP: Record<string, number> = {
      validation: 400,
      authentication: 401,
      authorization: 403,
      not_found: 404,
      rate_limit: 429,
      server_error: 500,
    };
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      (STATUS_MAP[sanitized.type] ?? 500) as never,
    );
  });

  // 4. Create mock Drizzle (reusing createTestApp's inline mock pattern)
  // We import the db's mock drizzle via the same dataStore
  const { createInlineMockDrizzle } =
    // @ts-expect-error -- optional helper module that may not exist
    await import("../../helpers/test-utils-drizzle-helper").catch(() => {
      // If the helper doesn't exist, we create the mock inline
      return { createInlineMockDrizzle: null };
    });

  // Build mock Drizzle from dataStore — reuse the same pattern as createTestApp
  // Since createInlineMockDrizzle is private in test-utils.ts, we access the
  // mock Drizzle that was already created by createTestDB/createTestApp
  let mockDrizzle: any;

  // We need to create a new Hono app that uses the SAME dataStore.
  // The simplest approach: call createTestApp with our db to get the pre-configured app
  const { createTestApp } = await import("../../helpers/test-utils");
  const baseApp = await createTestApp(db);

  // But createTestApp only mounts 13 routes. We need to mount additional routes
  // on the same app. Unfortunately createTestApp returns a Hono instance, not the
  // env object. So let's build from scratch using the same pattern.

  // Extract the mockDrizzle from the env that createTestApp would set up
  // by making a test request and capturing the env
  let capturedEnv: any = null;
  const probeApp = new Hono();
  probeApp.use("*", async (c, next) => {
    // Copy env from baseApp by making a sub-request
    capturedEnv = { ...(c as unknown as ApiTestContextWithEnv).env };
    await next();
  });

  // Actually, let's take a simpler approach: just use createTestApp and add
  // the extra routes to it. The Hono app supports adding routes after creation.

  // Mount additional routes that createTestApp doesn't include
  const apiV1Extra = new Hono<{ Bindings: Env }>();

  apiV1Extra.route("/waiting-list", waitingListFeature);
  apiV1Extra.route("/partnerships", partnershipsRoutes);
  apiV1Extra.route("/integrations", integrationsFeature.routes);
  apiV1Extra.route("/reservations", reservationsFeature);
  apiV1Extra.route("/seats", seatsFeature.routes);
  apiV1Extra.route("/customers", customersRouter);
  apiV1Extra.route("/notifications", notificationsRoutes);
  apiV1Extra.route("/guest-orders", guestOrdersRoutes);
  apiV1Extra.route("/auth", verificationFeature.routes);

  // Mount extra routes on the base app
  baseApp.route("/api/v1", apiV1Extra);

  // 5. Auth helper
  const authHelper: AuthHelper = {
    adminToken: (restaurantId = "1") =>
      generateTestToken({
        id: 1,
        username: "admin",
        role: 0,
        restaurantId: String(restaurantId),
      }),
    ownerToken: (userId, restaurantId) =>
      generateTestToken({
        id: userId,
        username: `owner-${userId}`,
        role: 1,
        restaurantId: String(restaurantId),
      }),
    staffToken: (userId, role, restaurantId) =>
      generateTestToken({
        id: userId,
        username: `staff-${userId}`,
        role,
        restaurantId: String(restaurantId),
      }),
    customerToken: (userId) =>
      generateTestToken({
        id: userId,
        username: `customer-${userId}`,
        role: 5,
        restaurantId: null,
      }),
  };

  return {
    app: baseApp,
    db,
    dataStore,
    authHelper,
  };
}
