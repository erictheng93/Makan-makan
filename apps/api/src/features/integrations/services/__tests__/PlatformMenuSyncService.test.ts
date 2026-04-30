import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformMenuSyncService } from "../PlatformMenuSyncService";
import type { MenuSyncResult } from "@makanmakan/shared-types";

// ─── Mock drizzle-orm/d1 ───────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _type: "eq", val })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
}));

vi.mock("@makanmakan/database", () => ({
  platformIntegrations: { restaurantId: "restaurantId", platform: "platform" },
  platformMenuMappings: {
    restaurantId: "restaurantId",
    platform: "platform",
    menuItemId: "menuItemId",
    id: "id",
  },
  menuItems: {
    restaurantId: "restaurantId",
    isAvailable: "isAvailable",
    categoryId: "categoryId",
  },
  categories: { restaurantId: "restaurantId" },
}));

// ─── Mock adapter ─────────────────────────────────────────────────────────

const mockAdapter = {
  platform: "uber_eats" as const,
  syncMenu: vi.fn(),
  verifyWebhook: vi.fn(),
  refreshToken: vi.fn(),
  parseOrder: vi.fn(),
  acceptOrder: vi.fn(),
  denyOrder: vi.fn(),
  cancelOrder: vi.fn(),
};

vi.mock("../../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mockAdapter),
}));

// ─── Mock PlatformIntegrationService ──────────────────────────────────────

const mockGetDecryptedCredentials = vi.fn();

vi.mock("../PlatformIntegrationService", () => {
  return {
    PlatformIntegrationService: class {
      getDecryptedCredentials = mockGetDecryptedCredentials;
    },
  };
});

// ─── Test environment ─────────────────────────────────────────────────────

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
} as never;

// ─── Chain helpers ────────────────────────────────────────────────────────

/** Select chain where the terminal call is .where() (no .limit) */
function makeSelectChainTerminalWhere(returnValue: unknown) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

/** Select chain where the terminal call is .limit() */
function makeSelectChainWithLimit(returnValue: unknown) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function makeInsertChain() {
  const chain: any = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("PlatformMenuSyncService", () => {
  let service: PlatformMenuSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformMenuSyncService(mockEnv);
  });

  describe("syncMenu — happy path", () => {
    it("should sync menu successfully and update mappings", async () => {
      const restaurantId = "rest-001";
      const platform = "uber_eats" as const;

      // 1st update call: mark as syncing
      const updateChain1 = makeUpdateChain();
      // 2nd update call: mark as success
      const updateChain2 = makeUpdateChain();
      // 3rd update call: update existing mapping
      const updateChain3 = makeUpdateChain();

      const updateCalls = [updateChain1, updateChain2, updateChain3];
      let updateIdx = 0;
      mockUpdate.mockImplementation(() => updateCalls[updateIdx++]);

      // select calls: categories, menuItems, existing mapping check
      const categoriesData = [
        { id: 1, name: "Main Course", restaurantId },
        { id: 2, name: "Drinks", restaurantId },
      ];
      const menuItemsData = [
        {
          id: 10,
          name: "Nasi Lemak",
          description: "Coconut rice",
          price: 1200,
          imageUrl: null,
          isAvailable: true,
          categoryId: 1,
          restaurantId,
        },
        {
          id: 20,
          name: "Teh Tarik",
          description: "Pulled tea",
          price: 500,
          imageUrl: null,
          isAvailable: true,
          categoryId: 2,
          restaurantId,
        },
      ];

      // categories & menuItems: terminal .where(), mapping checks: terminal .limit(1)
      const selectChainCategories =
        makeSelectChainTerminalWhere(categoriesData);
      const selectChainMenuItems = makeSelectChainTerminalWhere(menuItemsData);
      const selectChainMapping1 = makeSelectChainWithLimit([
        { id: 100, platformItemId: "old-plat-10" },
      ]);
      const selectChainMapping2 = makeSelectChainWithLimit([]);

      const selectCalls = [
        selectChainCategories,
        selectChainMenuItems,
        selectChainMapping1,
        selectChainMapping2,
      ];
      let selectIdx = 0;
      mockSelect.mockImplementation(() => selectCalls[selectIdx++]);

      // insert for new mapping (item 20)
      const insertChain = makeInsertChain();
      mockInsert.mockReturnValue(insertChain);

      // Adapter returns platformItemIds
      const syncResult: MenuSyncResult = {
        success: true,
        syncedItems: 2,
        platformItemIds: {
          10: "plat-item-10",
          20: "plat-item-20",
        },
      };
      mockAdapter.syncMenu.mockResolvedValue(syncResult);

      // Credentials
      const mockCreds = { clientId: "c1", clientSecret: "s1", storeId: "st1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);

      await service.syncMenu(restaurantId, platform);

      // Verify adapter was called with correct payload structure
      expect(mockAdapter.syncMenu).toHaveBeenCalledOnce();
      expect(mockAdapter.syncMenu).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId,
          categories: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              name: "Main Course",
              items: expect.arrayContaining([
                expect.objectContaining({ id: 10, name: "Nasi Lemak" }),
              ]),
            }),
          ]),
        }),
        mockCreds,
      );

      // Verify credentials were fetched
      expect(mockGetDecryptedCredentials).toHaveBeenCalledOnce();
      expect(mockGetDecryptedCredentials).toHaveBeenCalledWith(
        restaurantId,
        platform,
      );

      // Verify update was called (syncing status + success status + mapping update)
      expect(mockUpdate).toHaveBeenCalled();

      // Verify insert was called for the new mapping (item 20 had no existing)
      expect(mockInsert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId,
          platform,
          menuItemId: 20,
          platformItemId: "plat-item-20",
        }),
      );
    });

    it("should sync menu with no platformItemIds returned", async () => {
      const restaurantId = "rest-002";
      const platform = "uber_eats" as const;

      // update: syncing, then success
      const updateChain1 = makeUpdateChain();
      const updateChain2 = makeUpdateChain();
      let updateIdx = 0;
      mockUpdate.mockImplementation(
        () => [updateChain1, updateChain2][updateIdx++],
      );

      // select: categories (empty), menuItems (empty)
      const selectChain1 = makeSelectChainTerminalWhere([]);
      const selectChain2 = makeSelectChainTerminalWhere([]);
      let selectIdx = 0;
      mockSelect.mockImplementation(
        () => [selectChain1, selectChain2][selectIdx++],
      );

      mockAdapter.syncMenu.mockResolvedValue({
        success: true,
        syncedItems: 0,
      });
      mockGetDecryptedCredentials.mockResolvedValue({
        clientId: "c1",
        clientSecret: "s1",
      });

      await service.syncMenu(restaurantId, platform);

      // No insert calls since no platformItemIds
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockAdapter.syncMenu).toHaveBeenCalledOnce();
    });
  });

  describe("syncMenu — error handling", () => {
    it("should mark sync as error when adapter throws", async () => {
      const restaurantId = "rest-003";
      const platform = "uber_eats" as const;

      // update: syncing, then error
      const updateChain1 = makeUpdateChain();
      const updateChain2 = makeUpdateChain();
      let updateIdx = 0;
      mockUpdate.mockImplementation(
        () => [updateChain1, updateChain2][updateIdx++],
      );

      // select: categories, menuItems
      const selectChain1 = makeSelectChainTerminalWhere([
        { id: 1, name: "Cat", restaurantId },
      ]);
      const selectChain2 = makeSelectChainTerminalWhere([]);
      let selectIdx = 0;
      mockSelect.mockImplementation(
        () => [selectChain1, selectChain2][selectIdx++],
      );

      mockGetDecryptedCredentials.mockResolvedValue({ clientId: "c1" });
      mockAdapter.syncMenu.mockRejectedValue(new Error("Platform API timeout"));

      await expect(service.syncMenu(restaurantId, platform)).rejects.toThrow(
        "Platform API timeout",
      );

      // Verify error status was written — the second update call sets menuSyncStatus: "error"
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(updateChain2.set).toHaveBeenCalledWith(
        expect.objectContaining({
          menuSyncStatus: "error",
          menuSyncError: "Platform API timeout",
        }),
      );
    });

    it("should handle non-Error thrown values", async () => {
      const restaurantId = "rest-004";
      const platform = "uber_eats" as const;

      const updateChain1 = makeUpdateChain();
      const updateChain2 = makeUpdateChain();
      let updateIdx = 0;
      mockUpdate.mockImplementation(
        () => [updateChain1, updateChain2][updateIdx++],
      );

      const selectChain1 = makeSelectChainTerminalWhere([]);
      const selectChain2 = makeSelectChainTerminalWhere([]);
      let selectIdx = 0;
      mockSelect.mockImplementation(
        () => [selectChain1, selectChain2][selectIdx++],
      );

      mockGetDecryptedCredentials.mockResolvedValue({ clientId: "c1" });
      mockAdapter.syncMenu.mockRejectedValue("string error");

      await expect(service.syncMenu(restaurantId, platform)).rejects.toBe(
        "string error",
      );

      expect(updateChain2.set).toHaveBeenCalledWith(
        expect.objectContaining({
          menuSyncStatus: "error",
          menuSyncError: "string error",
        }),
      );
    });
  });
});
