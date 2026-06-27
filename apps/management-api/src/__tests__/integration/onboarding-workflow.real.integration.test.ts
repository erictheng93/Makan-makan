import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
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

function createEnv(db: D1DatabaseAdapter): ManagementEnv {
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
    CACHE_KV: {} as KVNamespace,
    DEPLOYMENT_STATUS_KV: {} as KVNamespace,
    BUNDLE_STORAGE: {} as R2Bucket,
  };
}

function createApplicationBody(subdomain: string) {
  return {
    businessName: "Workflow Laksa",
    contactName: "Tan Mei",
    contactEmail: "tan.mei@example.com",
    contactPhone: "0912345678",
    planId: "standard",
    subdomain,
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
  it("checks a subdomain, creates an application, and reads it back", async () => {
    const db = createManagementDb();
    const env = createEnv(db);

    const checkBefore = await app.fetch(
      new Request(
        "https://management.test/api/v1/onboarding/subdomain/check?subdomain=workflow-laksa",
      ),
      env,
    );

    expect(checkBefore.status).toBe(200);
    const checkBeforeJson: any = await checkBefore.json();
    expect(checkBeforeJson).toMatchObject({
      success: true,
      data: { subdomain: "workflow-laksa", available: true },
    });

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3004",
          "User-Agent": "onboarding-workflow-test",
        },
        body: JSON.stringify(createApplicationBody("workflow-laksa")),
      }),
      env,
    );

    expect(createResponse.status).toBe(201);
    const createJson: any = await createResponse.json();
    expect(createJson.success).toBe(true);
    expect(createJson.data).toMatchObject({
      assignedSubdomain: "workflow-laksa",
      status: "submitted",
    });
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
      assignedSubdomain: "workflow-laksa",
      status: "submitted",
    });
    expect(getJson.data.cfApiTokenEnc).toBeUndefined();

    const checkAfter = await app.fetch(
      new Request(
        "https://management.test/api/v1/onboarding/subdomain/check?subdomain=workflow-laksa",
      ),
      env,
    );

    expect(checkAfter.status).toBe(200);
    const checkAfterJson: any = await checkAfter.json();
    expect(checkAfterJson.success).toBe(true);
    expect(checkAfterJson.data.available).toBe(false);
    expect(checkAfterJson.data.suggestions.length).toBeGreaterThan(0);
  });

  it("rejects invalid application payloads with onboarding-app compatible errors", async () => {
    const db = createManagementDb();
    const env = createEnv(db);

    const response = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createApplicationBody("Invalid Subdomain"),
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
    const env = createEnv(db);
    const token = await managementToken();

    const createApprovedCandidate = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody("workflow-approved")),
      }),
      env,
    );
    const approvedCandidateJson: any = await createApprovedCandidate.json();
    const approvedCandidateId = approvedCandidateJson.data.applicationId;
    await db
      .prepare(
        `UPDATE onboarding_applications
         SET status = 'cf_verified', cf_account_id = 'account-123', cf_verified_at = '2026-06-01T00:00:00.000Z'
         WHERE id = ?`,
      )
      .bind(approvedCandidateId)
      .run();

    const createRejectedCandidate = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody("workflow-rejected")),
      }),
      env,
    );
    const rejectedCandidateJson: any = await createRejectedCandidate.json();
    const rejectedCandidateId = rejectedCandidateJson.data.applicationId;

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
          status: "cf_verified",
          assignedSubdomain: "workflow-approved",
        }),
        expect.objectContaining({
          id: rejectedCandidateId,
          status: "submitted",
          assignedSubdomain: "workflow-rejected",
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
      subdomain: "workflow-approved",
    });
    expect(typeof approveJson.data.tenantId).toBe("string");

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

  it("requires Cloudflare verification before admin approval", async () => {
    const db = createManagementDb();
    const env = createEnv(db);
    const token = await managementToken();

    const createResponse = await app.fetch(
      new Request("https://management.test/api/v1/onboarding/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createApplicationBody("workflow-unverified")),
      }),
      env,
    );
    const createJson: any = await createResponse.json();

    const response = await app.fetch(
      new Request(
        `https://management.test/api/v1/admin/onboarding/applications/${createJson.data.applicationId}/approve`,
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
