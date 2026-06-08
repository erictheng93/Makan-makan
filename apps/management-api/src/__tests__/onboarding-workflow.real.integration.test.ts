import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { D1DatabaseAdapter } from "../../../../tests/helpers/d1-adapter";
import app from "../index";
import type { ManagementEnv } from "../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../migrations");

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

    const getResponse = await app.fetch(
      new Request(
        `https://management.test/api/v1/onboarding/applications/${createJson.data.applicationId}`,
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
});
