import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformIntegrationService } from "../services/PlatformIntegrationService";
import type { PlatformCredentials } from "@makanmakan/shared-types";

// ─── Mock drizzle-orm/d1 ───────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Chain helpers
const makeSelectChain = (returnValue: unknown) => {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  platformIntegrations: {},
}));

// ─── Test environment ──────────────────────────────────────────────────────

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
} as unknown as ApiTestEnv;

describe("PlatformIntegrationService — Encryption", () => {
  let service: PlatformIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformIntegrationService(mockEnv);
  });

  it("should encrypt credentials and produce a base64 string", async () => {
    const creds: PlatformCredentials = {
      clientId: "test-client-id",
      clientSecret: "super-secret",
      storeId: "store-123",
    };

    const encrypted = await service.encryptCredentials(
      creds,
      mockEnv.ENCRYPTION_KEY,
    );

    expect(typeof encrypted).toBe("string");
    expect(encrypted.length).toBeGreaterThan(0);
    // Should be a valid base64 string (no JSON brackets directly visible)
    expect(() => atob(encrypted)).not.toThrow();
  });

  it("should decrypt back to the original credentials (round-trip)", async () => {
    const original: PlatformCredentials = {
      clientId: "client-abc",
      clientSecret: "secret-xyz",
      storeId: "store-999",
    };

    const encrypted = await service.encryptCredentials(
      original,
      mockEnv.ENCRYPTION_KEY,
    );
    const decrypted = await service.decryptCredentials(
      encrypted,
      mockEnv.ENCRYPTION_KEY,
    );

    expect(decrypted).toEqual(original);
  });

  it("should produce different ciphertext each time (due to random IV)", async () => {
    const creds: PlatformCredentials = { clientId: "abc", clientSecret: "def" };

    const enc1 = await service.encryptCredentials(
      creds,
      mockEnv.ENCRYPTION_KEY,
    );
    const enc2 = await service.encryptCredentials(
      creds,
      mockEnv.ENCRYPTION_KEY,
    );

    // The actual ciphertext must differ because of a fresh random IV each call
    expect(enc1).not.toBe(enc2);
  });

  it("should fail to decrypt when a different key is used", async () => {
    const creds: PlatformCredentials = { clientId: "id", clientSecret: "sec" };
    const encrypted = await service.encryptCredentials(
      creds,
      mockEnv.ENCRYPTION_KEY,
    );

    await expect(
      service.decryptCredentials(
        encrypted,
        "a-completely-different-key-32chars",
      ),
    ).rejects.toThrow();
  });

  it("should fail to decrypt corrupted ciphertext", async () => {
    // Corrupted base64 payload (valid base64 but random bytes)
    const corrupted = btoa("this-is-definitely-not-valid-aes-gcm-data-00000");

    await expect(
      service.decryptCredentials(corrupted, mockEnv.ENCRYPTION_KEY),
    ).rejects.toThrow();
  });

  it("should handle credentials with optional fields", async () => {
    const creds: PlatformCredentials = {
      clientId: "only-id",
    };

    const encrypted = await service.encryptCredentials(
      creds,
      mockEnv.ENCRYPTION_KEY,
    );
    const decrypted = await service.decryptCredentials(
      encrypted,
      mockEnv.ENCRYPTION_KEY,
    );

    expect(decrypted.clientId).toBe("only-id");
    expect(decrypted.clientSecret).toBeUndefined();
  });
});

describe("PlatformIntegrationService — CRUD", () => {
  let service: PlatformIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformIntegrationService(mockEnv);
  });

  it("getIntegrations returns all integrations for a restaurant", async () => {
    const mockIntegrations = [
      { id: 1, restaurantId: "rest-1", platform: "uber_eats", enabled: true },
    ];
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockIntegrations),
    };
    mockDb.select.mockReturnValue(selectChain);

    const result = await service.getIntegrations("rest-1");

    expect(result).toEqual(mockIntegrations);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("getIntegration returns the first matching record", async () => {
    const mockIntegration = {
      id: 1,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
    };
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockIntegration]),
    };
    mockDb.select.mockReturnValue(selectChain);

    const result = await service.getIntegration("rest-1", "uber_eats");

    expect(result).toEqual(mockIntegration);
  });

  it("getIntegration returns null when nothing is found", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(selectChain);

    const result = await service.getIntegration("rest-1", "uber_eats");

    expect(result).toBeNull();
  });

  it("connect inserts a new record when none exists", async () => {
    // getIntegration returns empty (no existing), then after insert returns the new record
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: no existing record
          return Promise.resolve([]);
        }
        // Second call (after insert): return new record
        return Promise.resolve([
          {
            id: 2,
            restaurantId: "rest-1",
            platform: "uber_eats",
            enabled: true,
            credentials: "encrypted",
          },
        ]);
      }),
    }));

    const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
    mockDb.insert.mockReturnValue(insertChain);

    const result = await service.connect("rest-1", "uber_eats", {
      clientId: "cid",
      clientSecret: "csec",
      storeId: "sid",
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("connect updates an existing record when one exists", async () => {
    const existingRecord = {
      id: 3,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
      credentials: "old-encrypted",
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([existingRecord]);
        }
        return Promise.resolve([
          { ...existingRecord, credentials: "new-encrypted" },
        ]);
      }),
    }));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb.update.mockReturnValue(updateChain);

    const result = await service.connect("rest-1", "uber_eats", {
      clientId: "new-cid",
      clientSecret: "new-csec",
      storeId: "new-sid",
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("disconnect deletes the integration record", async () => {
    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb.delete.mockReturnValue(deleteChain);

    await service.disconnect("rest-1", "uber_eats");

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("updateConfig merges new config with existing config", async () => {
    const existingRecord = {
      id: 1,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
      config: { autoAcceptOrders: false, menuSyncEnabled: false },
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([existingRecord]);
        }
        return Promise.resolve([
          {
            ...existingRecord,
            config: { autoAcceptOrders: true, menuSyncEnabled: false },
          },
        ]);
      }),
    }));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb.update.mockReturnValue(updateChain);

    const result = await service.updateConfig("rest-1", "uber_eats", {
      autoAcceptOrders: true,
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("getDecryptedCredentials throws when integration is not found", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(selectChain);

    await expect(
      service.getDecryptedCredentials("rest-1", "uber_eats"),
    ).rejects.toThrow(
      "No integration found for uber_eats in restaurant rest-1",
    );
  });
});
