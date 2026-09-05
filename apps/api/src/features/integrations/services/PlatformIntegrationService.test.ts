import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformIntegrations } from "@makanmasak/database";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";
import type { Env } from "../../../types/env";
import { PlatformIntegrationService } from "./PlatformIntegrationService";

const mocks = vi.hoisted(() => ({
  db: {
    delete: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createSelectQuery(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fixtureTables = { platformIntegrations };
type SelectFixtureName = keyof typeof fixtureTables;

function queueSelectResults(fixtures: SelectFixtures<SelectFixtureName>) {
  Object.assign(mocks.db, createSelectFixtureDb(fixtureTables, fixtures));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  let deleted = 0;

  mocks.db.insert.mockImplementation(() => ({
    values: vi.fn((payload: unknown) => {
      inserted.push(payload);
      return Promise.resolve();
    }),
  }));

  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => Promise.resolve()),
    };
    return builder;
  });

  mocks.db.delete.mockImplementation(() => {
    const builder = {
      where: vi.fn(() => {
        deleted++;
        return Promise.resolve();
      }),
    };
    return builder;
  });

  return {
    inserted,
    updated,
    get deleted() {
      return deleted;
    },
  };
}

function env(overrides: Partial<Env> = {}) {
  return {
    DB: { binding: "db" },
    CACHE_KV: {},
    ENCRYPTION_KEY: "test-encryption-key",
    ...overrides,
  } as Env;
}

describe("PlatformIntegrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists integrations and returns null for missing platform rows", async () => {
    queueSelectResults({
      platformIntegrations: [
        [{ id: "integration-1", platform: "uber_eats" }],
        [],
      ],
    });

    const service = new PlatformIntegrationService(env());

    await expect(service.getIntegrations("restaurant-1")).resolves.toEqual([
      { id: "integration-1", platform: "uber_eats" },
    ]);
    await expect(
      service.getIntegration("restaurant-1", "uber_eats"),
    ).resolves.toBeNull();

    expect(mocks.db.select).toHaveBeenCalledTimes(2);
  });

  it("connects new integrations with encrypted credentials and default config", async () => {
    const finalRow = {
      id: "integration-1",
      restaurantId: "restaurant-1",
      platform: "uber_eats",
      enabled: true,
    };
    queueSelectResults({ platformIntegrations: [[], [finalRow]] });
    const mutations = mockMutations();

    const service = new PlatformIntegrationService(env());
    await expect(
      service.connect("restaurant-1", "uber_eats", {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
      }),
    ).resolves.toEqual(finalRow);

    expect(mutations.inserted).toHaveLength(1);
    const payload = mutations.inserted[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      restaurantId: "restaurant-1",
      platform: "uber_eats",
      enabled: true,
      config: {
        autoAcceptOrders: false,
        menuSyncEnabled: false,
      },
      menuSyncStatus: "idle",
    });
    expect(payload.credentials).not.toBe("client-secret");
    await expect(
      service.decryptCredentials(
        payload.credentials as string,
        "test-encryption-key",
      ),
    ).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      storeId: "store-1",
    });
  });

  it("re-enables existing integrations and preserves explicit sync config", async () => {
    queueSelectResults({
      platformIntegrations: [
        [{ id: "integration-1", enabled: false }],
        [{ id: "integration-1", enabled: true }],
      ],
    });
    const mutations = mockMutations();

    const service = new PlatformIntegrationService(env());
    await expect(
      service.connect("restaurant-1", "uber_eats", {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
        autoAcceptOrders: true,
        menuSyncEnabled: true,
      }),
    ).resolves.toEqual({ id: "integration-1", enabled: true });

    expect(mutations.inserted).toHaveLength(0);
    expect(mutations.updated).toHaveLength(1);
    expect(mutations.updated[0]).toMatchObject({
      enabled: true,
      config: {
        autoAcceptOrders: true,
        menuSyncEnabled: true,
      },
    });
  });

  it("merges config updates and deletes integrations by platform scope", async () => {
    queueSelectResults({
      platformIntegrations: [
        [{ id: "integration-1", config: { autoAcceptOrders: false } }],
        [
          {
            id: "integration-1",
            config: { autoAcceptOrders: false, menuSyncEnabled: true },
          },
        ],
      ],
    });
    const mutations = mockMutations();

    const service = new PlatformIntegrationService(env());
    await expect(
      service.updateConfig("restaurant-1", "uber_eats", {
        menuSyncEnabled: true,
      }),
    ).resolves.toEqual({
      id: "integration-1",
      config: { autoAcceptOrders: false, menuSyncEnabled: true },
    });
    await service.disconnect("restaurant-1", "uber_eats");

    expect(mutations.updated).toEqual([
      expect.objectContaining({
        config: { autoAcceptOrders: false, menuSyncEnabled: true },
      }),
    ]);
    expect(mutations.deleted).toBe(1);
  });

  it("stores webhook secrets in encrypted credentials instead of config", async () => {
    const service = new PlatformIntegrationService(env());
    const encrypted = await service.encryptCredentials(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
      },
      "test-encryption-key",
    );
    queueSelectResults({
      platformIntegrations: [
        [
          {
            id: "integration-1",
            credentials: encrypted,
            config: {
              webhookSecret: "legacy-plain-secret",
              autoAcceptOrders: false,
            },
          },
        ],
        [{ id: "integration-1" }],
      ],
    });
    const mutations = mockMutations();

    await service.updateConfig("restaurant-1", "uber_eats", {
      webhookSecret: "webhook-secret",
      menuSyncEnabled: true,
    });

    expect(mutations.updated).toHaveLength(1);
    const payload = mutations.updated[0] as Record<string, unknown>;
    expect(payload.config).toEqual({
      autoAcceptOrders: false,
      menuSyncEnabled: true,
    });
    expect(payload.config).not.toHaveProperty("webhookSecret");
    expect(payload.credentials).not.toBe("webhook-secret");
    await expect(
      service.decryptCredentials(
        payload.credentials as string,
        "test-encryption-key",
      ),
    ).resolves.toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      storeId: "store-1",
      webhookSecret: "webhook-secret",
    });
  });

  it("round-trips decrypted credentials and rejects missing integrations", async () => {
    const service = new PlatformIntegrationService(env());
    const encrypted = await service.encryptCredentials(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
      },
      "test-encryption-key",
    );
    queueSelectResults({
      platformIntegrations: [[{ credentials: encrypted }], []],
    });

    await expect(
      service.getDecryptedCredentials("restaurant-1", "uber_eats"),
    ).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      storeId: "store-1",
    });
    await expect(
      service.getDecryptedCredentials("restaurant-1", "uber_eats"),
    ).rejects.toThrow(
      "No integration found for uber_eats in restaurant restaurant-1",
    );
  });

  it("reads encrypted credentials stored by the legacy JSON-mode column", async () => {
    const service = new PlatformIntegrationService(env());
    const encrypted = await service.encryptCredentials(
      {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
      },
      "test-encryption-key",
    );

    await expect(
      service.readStoredCredentials(JSON.stringify(encrypted)),
    ).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      storeId: "store-1",
    });
  });

  it("round-trips credentials with the short fixture key outside production", async () => {
    // The weak-key guard is production-only precisely so this keeps working:
    // "test-encryption-key" is 19 characters, well under the 32-character floor.
    const service = new PlatformIntegrationService(env({ NODE_ENV: "test" }));
    const encrypted = await service.encryptCredentials(
      { clientId: "client-id", clientSecret: "client-secret" },
      "test-encryption-key",
    );

    await expect(
      service.decryptCredentials(encrypted, "test-encryption-key"),
    ).resolves.toEqual(
      expect.objectContaining({
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    );
  });

  it("refuses to store credentials in production without ENCRYPTION_KEY", async () => {
    // makanmasak-api-prod has no ENCRYPTION_KEY secret; the old code derived a
    // valid AES-256 key from the empty string and wrote the row anyway (#300).
    const mutations = mockMutations();
    const service = new PlatformIntegrationService(
      env({
        NODE_ENV: "production",
        ENCRYPTION_KEY: undefined as unknown as string,
      }),
    );

    await expect(
      service.connect("restaurant-1", "uber_eats", {
        clientId: "client-id",
        clientSecret: "client-secret",
        storeId: "store-1",
      }),
    ).rejects.toThrow(/ENCRYPTION_KEY/);
    expect(mutations.inserted).toHaveLength(0);
    expect(mutations.updated).toHaveLength(0);
  });

  it("refuses to read stored credentials in production with a short key", async () => {
    const lenient = new PlatformIntegrationService(env({ NODE_ENV: "test" }));
    const encrypted = await lenient.encryptCredentials(
      { clientId: "client-id" },
      "test-encryption-key",
    );

    const strict = new PlatformIntegrationService(
      env({ NODE_ENV: "production", ENCRYPTION_KEY: "short-key" }),
    );

    await expect(strict.readStoredCredentials(encrypted)).rejects.toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it("rejects rows written by the retired unsalted credential format", async () => {
    // Pre-#300 rows were base64(iv||ciphertext) with no ':' separator, keyed by
    // a bare SHA-256 of the secret. That code path is gone; say so rather than
    // failing with an opaque AES-GCM error.
    const service = new PlatformIntegrationService(env());

    await expect(
      service.readStoredCredentials(btoa("legacy-blob-without-separator")),
    ).rejects.toThrow(/retired unsalted encryption format/);
  });

  it("reads plaintext credentials stored by legacy JSON rows", async () => {
    const service = new PlatformIntegrationService(env());

    await expect(
      service.readStoredCredentials(
        JSON.stringify({
          clientId: "client-id",
          clientSecret: "client-secret",
          storeId: "store-1",
        }),
      ),
    ).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      storeId: "store-1",
    });
  });
});
