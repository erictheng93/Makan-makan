import { describe, expect, it, vi } from "vitest";
import { BundleService } from "./BundleService";
import type { ManagementEnv } from "../types";

type StoredObject = {
  text: () => Promise<string>;
};

const object = (value: string): StoredObject => ({
  text: async () => value,
});

const envWithStorage = (storage: Partial<R2Bucket>) =>
  ({
    BUNDLE_STORAGE: storage,
  }) as ManagementEnv;

describe("BundleService", () => {
  it("returns null when the requested worker script is missing", async () => {
    const storage = {
      get: vi.fn().mockResolvedValue(null),
    };

    await expect(
      new BundleService(envWithStorage(storage)).getBundle("1.2.0"),
    ).resolves.toBeNull();
    expect(storage.get).toHaveBeenCalledWith("bundles/1.2.0/worker.js");
  });

  it("loads worker script and migrations for a bundle version", async () => {
    const migrations = [{ name: "0001_init.sql", sql: "CREATE TABLE t(id);" }];
    const storage = {
      get: vi.fn((key: string) => {
        if (key.endsWith("worker.js")) {
          return Promise.resolve(object("export default {};"));
        }
        if (key.endsWith("migrations.json")) {
          return Promise.resolve(object(JSON.stringify(migrations)));
        }
        return Promise.resolve(null);
      }),
    };

    await expect(
      new BundleService(envWithStorage(storage)).getBundle("1.2.0"),
    ).resolves.toEqual({
      version: "1.2.0",
      script: "export default {};",
      migrations,
    });
  });

  it("lists bundle versions newest first from R2 prefixes", async () => {
    const storage = {
      list: vi.fn().mockResolvedValue({
        delimitedPrefixes: [
          "bundles/1.0.0/",
          "bundles/1.2.0/",
          "bundles/1.1.0/",
        ],
      }),
    };

    await expect(
      new BundleService(envWithStorage(storage)).listVersions(),
    ).resolves.toEqual(["1.2.0", "1.1.0", "1.0.0"]);
    expect(storage.list).toHaveBeenCalledWith({
      prefix: "bundles/",
      delimiter: "/",
    });
  });

  it("uploads script, migrations, and manifest for a bundle", async () => {
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
      "2026-06-07T00:00:00.000Z",
    );
    const storage = {
      put: vi.fn().mockResolvedValue(undefined),
    };
    const migrations = [{ name: "0001_init.sql", sql: "CREATE TABLE t(id);" }];

    await new BundleService(envWithStorage(storage)).uploadBundle(
      "1.2.0",
      "export default {};",
      migrations,
    );

    expect(storage.put.mock.calls).toEqual([
      ["bundles/1.2.0/worker.js", "export default {};"],
      ["bundles/1.2.0/migrations.json", JSON.stringify(migrations)],
      [
        "bundles/1.2.0/manifest.json",
        JSON.stringify({
          version: "1.2.0",
          migrations,
          createdAt: "2026-06-07T00:00:00.000Z",
        }),
      ],
    ]);
  });
});
