import { describe, it, expect, vi, beforeEach } from "vitest";
import { BundleService } from "../../services/BundleService";
import { createMockEnv, createMockR2Bucket } from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let service: BundleService;

function mockR2() {
  return env.BUNDLE_STORAGE as unknown as ReturnType<typeof createMockR2Bucket>;
}

describe("BundleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new BundleService(env);
  });

  describe("getBundle", () => {
    it("should return null when bundle does not exist", async () => {
      const r2 = mockR2();
      r2.get.mockResolvedValue(null);

      const bundle = await service.getBundle("1.0.0");
      expect(bundle).toBeNull();
    });

    it("should return bundle with script and migrations", async () => {
      const r2 = mockR2();

      const scriptObj = {
        text: () => Promise.resolve("console.log('worker');"),
      };
      const migrationsObj = {
        text: () =>
          Promise.resolve(
            JSON.stringify([
              { name: "0001_init.sql", sql: "CREATE TABLE test (id TEXT);" },
            ]),
          ),
      };

      r2.get.mockImplementation(async (key: string) => {
        if (key.endsWith("worker.js")) return scriptObj;
        if (key.endsWith("migrations.json")) return migrationsObj;
        return null;
      });

      const bundle = await service.getBundle("1.0.0");
      expect(bundle).not.toBeNull();
      expect(bundle!.version).toBe("1.0.0");
      expect(bundle!.script).toBe("console.log('worker');");
      expect(bundle!.migrations).toHaveLength(1);
    });

    it("should handle bundle with no migrations file", async () => {
      const r2 = mockR2();

      const scriptObj = { text: () => Promise.resolve("worker code") };
      r2.get.mockImplementation(async (key: string) => {
        if (key.endsWith("worker.js")) return scriptObj;
        return null;
      });

      const bundle = await service.getBundle("1.0.0");
      expect(bundle).not.toBeNull();
      expect(bundle!.migrations).toEqual([]);
    });
  });

  describe("uploadBundle", () => {
    it("should upload script, migrations, and manifest to R2", async () => {
      const r2 = mockR2();

      await service.uploadBundle("1.2.0", "worker code", [
        { name: "0001.sql", sql: "CREATE TABLE t (id TEXT);" },
      ]);

      expect(r2.put).toHaveBeenCalledTimes(3);
      expect(r2.put).toHaveBeenCalledWith(
        "bundles/1.2.0/worker.js",
        "worker code",
      );
      expect(r2.put).toHaveBeenCalledWith(
        "bundles/1.2.0/migrations.json",
        expect.any(String),
      );
      expect(r2.put).toHaveBeenCalledWith(
        "bundles/1.2.0/manifest.json",
        expect.any(String),
      );
    });
  });

  describe("listVersions", () => {
    it("should return empty array when no bundles exist", async () => {
      const r2 = mockR2();
      r2.list.mockResolvedValue({
        objects: [],
        delimitedPrefixes: [],
        truncated: false,
      });

      const versions = await service.listVersions();
      expect(versions).toEqual([]);
    });

    it("should return versions sorted latest first", async () => {
      const r2 = mockR2();
      r2.list.mockResolvedValue({
        objects: [],
        delimitedPrefixes: [
          "bundles/1.0.0/",
          "bundles/1.1.0/",
          "bundles/1.2.0/",
        ],
        truncated: false,
      });

      const versions = await service.listVersions();
      expect(versions).toEqual(["1.2.0", "1.1.0", "1.0.0"]);
    });
  });
});
