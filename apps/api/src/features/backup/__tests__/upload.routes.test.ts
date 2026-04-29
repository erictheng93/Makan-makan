import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { BackupRoutes } from "../routes";

function createMockEnv() {
  return {
    DB: {},
    BACKUP_STORAGE: {
      put: vi.fn().mockResolvedValue(undefined),
    },
    BACKUP_KV: {
      put: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function buildApp() {
  const app = new Hono<any>();
  app.use("*", async (c, next) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  });
  app.route("/backup", BackupRoutes);
  return app;
}

describe("Backup Upload Compatibility Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores offline backup payloads in R2 and indexes metadata in KV", async () => {
    const app = buildApp();
    const env = createMockEnv();

    const response = await app.request(
      "/backup/upload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup_id: "backup-1",
          restaurant_id: "rest-1",
          snapshot: { orders: [] },
        }),
      },
      env,
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        backup_id: "backup-1",
        uploaded: true,
        restaurant_id: "rest-1",
        storage_key: "offline-uploads/rest-1/backup-1.json",
      },
    });
    expect(env.BACKUP_STORAGE.put).toHaveBeenCalledWith(
      "offline-uploads/rest-1/backup-1.json",
      expect.stringContaining('"backupId":"backup-1"'),
      { httpMetadata: { contentType: "application/json" } },
    );
    expect(env.BACKUP_KV.put).toHaveBeenCalledWith(
      "backup:offline-upload:backup-1",
      expect.stringContaining('"storageKey":"offline-uploads/rest-1/backup-1.json"'),
      { expirationTtl: 7776000 },
    );
  });

  it("rejects owner backup uploads for another restaurant", async () => {
    const app = buildApp();
    const env = createMockEnv();

    const response = await app.request(
      "/backup/upload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup_id: "backup-2",
          restaurant_id: "rest-2",
          snapshot: { orders: [] },
        }),
      },
      env,
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("BACKUP_UPLOAD_FORBIDDEN");
    expect(env.BACKUP_STORAGE.put).not.toHaveBeenCalled();
    expect(env.BACKUP_KV.put).not.toHaveBeenCalled();
  });
});
