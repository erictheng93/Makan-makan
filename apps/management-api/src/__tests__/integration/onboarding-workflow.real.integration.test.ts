import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { D1DatabaseAdapter } from "../../../../../tests/helpers/d1-adapter";
import app from "../../index";
import type { ManagementEnv } from "../../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../../migrations");

function createManagementDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = OFF");

  for (const file of fs.readdirSync(migrationsDir).sort()) {
    if (!file.endsWith(".sql")) continue;
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
  }

  return new D1DatabaseAdapter(sqlite);
}

function createPlatformDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = OFF");
  sqlite.exec(`
    CREATE TABLE restaurants (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      district TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '台中市',
      phone TEXT NOT NULL,
      email TEXT,
      website TEXT,
      messaging_channels TEXT,
      business_hours TEXT,
      latitude REAL,
      longitude REAL,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      logo_url TEXT,
      banner_url TEXT,
      image_urls TEXT,
      shop_qr_code TEXT UNIQUE,
      shop_qr_code_image_url TEXT,
      enable_shop_mode INTEGER NOT NULL DEFAULT 0,
      shop_qr_settings TEXT,
      shop_qr_version INTEGER NOT NULL DEFAULT 1,
      settings TEXT,
      rating REAL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      deleted_at_ms INTEGER,
      cuisine_tags TEXT,
      price_range INTEGER,
      supports_takeaway INTEGER NOT NULL DEFAULT 0,
      supports_delivery INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role INTEGER NOT NULL DEFAULT 4,
      restaurant_id TEXT,
      address TEXT,
      date_of_birth TEXT,
      profile_image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_verified INTEGER NOT NULL DEFAULT 0,
      preferences TEXT,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      last_login_at_ms INTEGER,
      password_changed_at_ms INTEGER,
      token_version INTEGER NOT NULL DEFAULT 1,
      email_verified_at_ms INTEGER,
      phone_verified_at_ms INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      deleted_at_ms INTEGER
    );

    CREATE TABLE password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      token_type TEXT NOT NULL DEFAULT 'email',
      otp_code TEXT,
      expires_at_ms INTEGER NOT NULL,
      used_at_ms INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at_ms INTEGER NOT NULL
    );

    CREATE TABLE onboarding_credential_deliveries (
      id TEXT PRIMARY KEY NOT NULL,
      application_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      username TEXT NOT NULL,
      setup_password_link TEXT NOT NULL,
      setup_password_expires_at TEXT NOT NULL,
      delivery_channel TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return new D1DatabaseAdapter(sqlite);
}

function createEnv(
  db: D1DatabaseAdapter,
  platformDb: D1DatabaseAdapter = createPlatformDb(),
): ManagementEnv {
  return {
    NODE_ENV: "test",
    API_VERSION: "v1",
    API_BASE_URL: "http://localhost",
    CORS_ORIGIN: "http://localhost:3004",
    LOG_LEVEL: "error",
    JWT_SECRET: "test-secret",
    ENCRYPTION_KEY: "a".repeat(32),
    CF_API_TOKEN: "test-token",
    CF_ACCOUNT_ID: "test-account",
    MANAGEMENT_DB: db as unknown as D1Database,
    PLATFORM_DB: platformDb as unknown as D1Database,
    CACHE_KV: {} as KVNamespace,
    DEPLOYMENT_STATUS_KV: {} as KVNamespace,
    BUNDLE_STORAGE: {} as R2Bucket,
  };
}

function createApplicationBody() {
  return {
    businessName: "Workflow Laksa",
    contactName: "Tan Mei",
    contactEmail: "tan.mei@example.com",
    contactPhone: "0912345678",
    planId: "standard",
    latitude: 24.147736,
    longitude: 120.673648,
  };
}

async function managementToken() {
  return sign(
    {
      id: "workflow-admin",
      email: "workflow-admin@example.test",
      role: "admin",
      aud: "management",
      iss: "makanmakan-management",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    "test-secret",
    "HS256",
  );
}

describe("Onboarding public API workflow — real integration", () => {
  it("does not expose the legacy public subdomain check endpoint", async () => {
    const db = createManagementDb();
    const platformDb = createPlatformDb();
    const env = createEnv(db, platformDb);

    const response = await app.fetch(
      new Request(
        "https://management.test/api/v1/onboarding/subdomain/check?subdomain=workflow-laksa",
      ),
      env,
    );

    expect(response.status).not.toBe(200);
  });

  it("creates an application with an auto-generated subdomain and reads it back", async () => {
    const db = createManagementDb();
    const env = createEnv(db);

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3004",
          "User-Agent": "onboarding-workflow-test",
        },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );

    expect(createResponse.status).toBe(201);
    const createJson: any = await createResponse.json();
    expect(createJson.success).toBe(true);
    expect(createJson.data).toMatchObject({
      status: "submitted",
    });
    expect(createJson.data.assignedSubdomain).toMatch(/^workflow-laksa-/);
    expect(typeof createJson.data.applicationId).toBe("string");
    expect(typeof createJson.data.applicationSecret).toBe("string");

    const getResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/onboarding/applications/${createJson.data.applicationId}`,
        {
          headers: {
            "X-Onboarding-Secret": createJson.data.applicationSecret,
          },
        },
      ),
      env,
    );

    expect(getResponse.status).toBe(200);
    const getJson: any = await getResponse.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data).toMatchObject({
      id: createJson.data.applicationId,
      businessName: "Workflow Laksa",
      contactName: "Tan Mei",
      contactEmail: "tan.mei@example.com",
      latitude: 24.147736,
      longitude: 120.673648,
      planId: "standard",
      assignedSubdomain: createJson.data.assignedSubdomain,
      status: "submitted",
    });
    expect(getJson.data.cfApiTokenEnc).toBeUndefined();
  });

  it("rejects invalid application payloads with onboarding-app compatible errors", async () => {
    const db = createManagementDb();
    const env = createEnv(db);

    const response = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createApplicationBody(),
          contactEmail: "not-an-email",
          latitude: 200,
        }),
      }),
      env,
    );

    expect(response.status).toBe(400);
    const json: any = await response.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(json.details)).toBe(true);
    expect(json.details.length).toBeGreaterThan(0);
  });

  it("lets platform admins list, approve, and reject onboarding applications", async () => {
    const db = createManagementDb();
    const platformDb = createPlatformDb();
    const env = createEnv(db, platformDb);
    const token = await managementToken();

    const createApprovedCandidate = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const approvedCandidateJson: any = await createApprovedCandidate.json();
    const approvedCandidateId = approvedCandidateJson.data.applicationId;
    const approvedSubdomain = approvedCandidateJson.data.assignedSubdomain;

    const createRejectedCandidate = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const rejectedCandidateJson: any = await createRejectedCandidate.json();
    const rejectedCandidateId = rejectedCandidateJson.data.applicationId;
    const rejectedSubdomain = rejectedCandidateJson.data.assignedSubdomain;

    const listResponse = await app.fetch(
      new Request(
        "https://management.test/api/v1/admin/onboarding/applications?limit=10",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    expect(listResponse.status).toBe(200);
    const listJson: any = await listResponse.json();
    expect(listJson.data.total).toBe(2);
    expect(listJson.data.applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: approvedCandidateId,
          status: "submitted",
          assignedSubdomain: approvedSubdomain,
        }),
        expect.objectContaining({
          id: rejectedCandidateId,
          status: "submitted",
          assignedSubdomain: rejectedSubdomain,
        }),
      ]),
    );
    expect(listJson.data.applications[0].cfApiTokenEnc).toBeUndefined();

    const approveResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${approvedCandidateId}/approve`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    expect(approveResponse.status).toBe(200);
    const approveJson: any = await approveResponse.json();
    expect(approveJson.data).toMatchObject({
      status: "completed",
      subdomain: approvedSubdomain,
      ownerAccount: {
        username: "tan.mei",
      },
    });
    expect(typeof approveJson.data.tenantId).toBe("string");
    expect(typeof approveJson.data.ownerAccount.restaurantId).toBe("string");
    expect(typeof approveJson.data.ownerAccount.userId).toBe("string");
    expect(typeof approveJson.data.ownerAccount.setupPasswordToken).toBe(
      "string",
    );
    expect(approveJson.data.ownerAccount.setupPasswordLink).toBe(
      `http://localhost:3004/reset-password?token=${approveJson.data.ownerAccount.setupPasswordToken}`,
    );
    expect("initialPassword" in approveJson.data.ownerAccount).toBe(false);
    expect(approveJson.data.credentialDelivery).toMatchObject({
      channel: "manual",
      status: "pending",
      recipientEmail: "tan.mei@example.com",
      recipientName: "Tan Mei",
    });
    expect(approveJson.data.credentialDelivery.setupPasswordLink).toBe(
      approveJson.data.ownerAccount.setupPasswordLink,
    );

    const tenantRow = db
      .raw()
      .prepare(
        `SELECT status, platform_restaurant_id, owner_user_id, owner_username
         FROM tenants WHERE id = ?`,
      )
      .get(approveJson.data.tenantId);
    expect(tenantRow).toMatchObject({
      status: "active",
      platform_restaurant_id: approveJson.data.ownerAccount.restaurantId,
      owner_user_id: approveJson.data.ownerAccount.userId,
      owner_username: "tan.mei",
    });

    const restaurantRow = platformDb
      .raw()
      .prepare(
        "SELECT id, name, email, is_available, is_active FROM restaurants WHERE id = ?",
      )
      .get(approveJson.data.ownerAccount.restaurantId);
    expect(restaurantRow).toMatchObject({
      id: approveJson.data.ownerAccount.restaurantId,
      name: "Workflow Laksa",
      email: "tan.mei@example.com",
      is_available: 0,
      is_active: 1,
    });

    const userRow = platformDb
      .raw()
      .prepare(
        `SELECT id, username, email, full_name, password_hash, role,
                restaurant_id, is_active
         FROM users WHERE id = ?`,
      )
      .get(approveJson.data.ownerAccount.userId) as {
      password_hash: string;
    } & Record<string, unknown>;
    expect(userRow).toMatchObject({
      id: approveJson.data.ownerAccount.userId,
      username: "tan.mei",
      email: "tan.mei@example.com",
      full_name: "Tan Mei",
      role: 1,
      restaurant_id: approveJson.data.ownerAccount.restaurantId,
      is_active: 1,
    });
    await expect(
      bcrypt.compare("Mkm-ABCDEF-GHIJKL!", userRow.password_hash),
    ).resolves.toBe(false);

    const resetTokenRow = platformDb
      .raw()
      .prepare(
        `SELECT user_id, token, token_type, expires_at_ms, used_at_ms
         FROM password_reset_tokens WHERE user_id = ?`,
      )
      .get(approveJson.data.ownerAccount.userId);
    expect(resetTokenRow).toMatchObject({
      user_id: approveJson.data.ownerAccount.userId,
      token: approveJson.data.ownerAccount.setupPasswordToken,
      token_type: "email",
      used_at_ms: null,
    });

    const deliveryRow = db
      .raw()
      .prepare(
        `SELECT application_id, tenant_id, restaurant_id, user_id,
                recipient_email, recipient_name, username,
                setup_password_link, delivery_channel, status
         FROM onboarding_credential_deliveries
         WHERE application_id = ?`,
      )
      .get(approvedCandidateId);
    expect(deliveryRow).toMatchObject({
      application_id: approvedCandidateId,
      tenant_id: approveJson.data.tenantId,
      restaurant_id: approveJson.data.ownerAccount.restaurantId,
      user_id: approveJson.data.ownerAccount.userId,
      recipient_email: "tan.mei@example.com",
      recipient_name: "Tan Mei",
      username: "tan.mei",
      setup_password_link: approveJson.data.ownerAccount.setupPasswordLink,
      delivery_channel: "manual",
      status: "pending",
    });

    const incompleteProfileCount = platformDb
      .raw()
      .prepare(
        `SELECT COUNT(*) AS count
         FROM restaurants
         WHERE address = '待補充'
            OR district = '待補充'
            OR phone = '00000000'`,
      )
      .get();
    expect(incompleteProfileCount).toMatchObject({ count: 0 });

    const rejectResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${rejectedCandidateId}/reject`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    expect(rejectResponse.status).toBe(200);
    await expect(rejectResponse.json()).resolves.toMatchObject({
      success: true,
      data: { status: "rejected" },
    });
    expect(
      platformDb.raw().prepare("SELECT COUNT(*) AS count FROM users").get(),
    ).toMatchObject({ count: 1 });
    expect(
      platformDb
        .raw()
        .prepare("SELECT COUNT(*) AS count FROM restaurants")
        .get(),
    ).toMatchObject({ count: 1 });
  });

  it("keeps approve idempotent after completion without creating duplicate platform records", async () => {
    const db = createManagementDb();
    const platformDb = createPlatformDb();
    const env = createEnv(db, platformDb);
    const token = await managementToken();

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const createJson: any = await createResponse.json();
    const approveUrl = `https://management.test/api/v1/admin/onboarding/applications/${createJson.data.applicationId}/approve`;

    const firstApprove = await app.fetch(
      new Request(approveUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );
    const firstJson: any = await firstApprove.json();

    const secondApprove = await app.fetch(
      new Request(approveUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );
    const secondJson: any = await secondApprove.json();

    expect(secondApprove.status).toBe(200);
    expect(secondJson.data).toMatchObject({
      status: "completed",
      tenantId: firstJson.data.tenantId,
      ownerAccount: {
        userId: firstJson.data.ownerAccount.userId,
        restaurantId: firstJson.data.ownerAccount.restaurantId,
        username: firstJson.data.ownerAccount.username,
        setupPasswordToken: firstJson.data.ownerAccount.setupPasswordToken,
      },
      credentialDelivery: {
        status: "pending",
        channel: "manual",
      },
    });
    expect(
      platformDb.raw().prepare("SELECT COUNT(*) AS count FROM users").get(),
    ).toMatchObject({ count: 1 });
    expect(
      platformDb
        .raw()
        .prepare("SELECT COUNT(*) AS count FROM restaurants")
        .get(),
    ).toMatchObject({ count: 1 });
    expect(
      db.raw().prepare("SELECT COUNT(*) AS count FROM tenants").get(),
    ).toMatchObject({ count: 1 });
    expect(
      db
        .raw()
        .prepare(
          "SELECT COUNT(*) AS count FROM onboarding_credential_deliveries",
        )
        .get(),
    ).toMatchObject({ count: 1 });
  });

  it("rolls back tenant and platform records when setup token provisioning fails", async () => {
    const db = createManagementDb();
    const platformDb = createPlatformDb();
    platformDb.raw().prepare("DROP TABLE password_reset_tokens").run();
    const env = createEnv(db, platformDb);
    const token = await managementToken();

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const createJson: any = await createResponse.json();

    const approveResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${createJson.data.applicationId}/approve`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    expect(approveResponse.status).toBe(400);
    expect(
      db.raw().prepare("SELECT status FROM onboarding_applications").get(),
    ).toMatchObject({ status: "submitted" });
    expect(
      db.raw().prepare("SELECT COUNT(*) AS count FROM tenants").get(),
    ).toMatchObject({ count: 0 });
    expect(
      db
        .raw()
        .prepare("SELECT COUNT(*) AS count FROM shop_subscriptions")
        .get(),
    ).toMatchObject({ count: 0 });
    expect(
      platformDb.raw().prepare("SELECT COUNT(*) AS count FROM users").get(),
    ).toMatchObject({ count: 0 });
    expect(
      platformDb
        .raw()
        .prepare("SELECT COUNT(*) AS count FROM restaurants")
        .get(),
    ).toMatchObject({ count: 0 });
  });

  it("does not let applicants complete applications without platform approval", async () => {
    const db = createManagementDb();
    const env = createEnv(db);

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const createJson: any = await createResponse.json();

    const completeResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/onboarding/applications/${createJson.data.applicationId}/complete`,
        {
          method: "POST",
          headers: { "X-Onboarding-Secret": createJson.data.applicationSecret },
        },
      ),
      env,
    );

    expect(completeResponse.status).toBe(401);
    const tenantCount = db
      .raw()
      .prepare("SELECT COUNT(*) AS count FROM tenants")
      .get();
    expect(tenantCount).toMatchObject({ count: 0 });
  });

  it("rejects completed applications from admin rejection", async () => {
    const db = createManagementDb();
    const env = createEnv(db);
    const token = await managementToken();

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody()),
      }),
      env,
    );
    const createJson: any = await createResponse.json();

    await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${createJson.data.applicationId}/approve`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    const response = await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${createJson.data.applicationId}/reject`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "INVALID_STATUS",
    });
  });
});
