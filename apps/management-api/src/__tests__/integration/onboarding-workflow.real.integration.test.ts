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
      latitude REAL,
      longitude REAL,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
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
      is_active INTEGER NOT NULL DEFAULT 1,
      is_verified INTEGER NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0,
      token_version INTEGER NOT NULL DEFAULT 1,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
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
    expect(typeof approveJson.data.ownerAccount.initialPassword).toBe("string");

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
        "SELECT id, name, email, is_active FROM restaurants WHERE id = ?",
      )
      .get(approveJson.data.ownerAccount.restaurantId);
    expect(restaurantRow).toMatchObject({
      id: approveJson.data.ownerAccount.restaurantId,
      name: "Workflow Laksa",
      email: "tan.mei@example.com",
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
      bcrypt.compare(
        approveJson.data.ownerAccount.initialPassword,
        userRow.password_hash,
      ),
    ).resolves.toBe(true);

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
