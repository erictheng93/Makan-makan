import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { D1DatabaseAdapter } from "../../../../tests/helpers/d1-adapter";
import { OnboardingService } from "../services/OnboardingService";
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
    CORS_ORIGIN: "*",
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

describe("OnboardingService location capture", () => {
  it("persists restaurant coordinates on new applications", async () => {
    const db = createManagementDb();
    const service = new OnboardingService(createEnv(db));

    const application = await service.createApplication({
      businessName: "GPS Dumpling",
      contactName: "Lin Mei",
      contactEmail: "mei@example.com",
      contactPhone: "0912345678",
      planId: "standard",
      latitude: 24.147736,
      longitude: 120.673648,
    });

    expect(application.latitude).toBe(24.147736);
    expect(application.longitude).toBe(120.673648);

    const row = await db
      .prepare(
        `SELECT latitude, longitude
         FROM onboarding_applications
         WHERE id = ?`,
      )
      .bind(application.id)
      .first<{ latitude: number; longitude: number }>();

    expect(row).toEqual({
      latitude: 24.147736,
      longitude: 120.673648,
    });
  });
});
