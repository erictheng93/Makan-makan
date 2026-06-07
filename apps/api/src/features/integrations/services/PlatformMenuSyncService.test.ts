import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import { PlatformMenuSyncService } from "./PlatformMenuSyncService";

const mocks = vi.hoisted(() => ({
  adapter: {
    syncMenu: vi.fn(),
  },
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
  integrationService: {
    getDecryptedCredentials: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mocks.adapter),
}));

vi.mock("./PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function PlatformIntegrationService() {
    return mocks.integrationService;
  }),
}));

function createSelectQuery(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function queueSelectResults(results: unknown[][]) {
  mocks.db.select.mockImplementation(() =>
    createSelectQuery(results.shift() ?? []),
  );
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

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

  return { inserted, updated };
}

function createService() {
  return new PlatformMenuSyncService({
    DB: { binding: "db" },
  } as unknown as Env);
}

describe("PlatformMenuSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mocks.integrationService.getDecryptedCredentials.mockResolvedValue({
      accessToken: "token-1",
      storeId: "store-1",
    });
    mocks.adapter.syncMenu.mockResolvedValue({
      success: true,
      syncedItems: 2,
      platformItemIds: {
        101: "platform-101",
        102: "platform-102",
      },
    });
  });

  it("syncs active menu items and upserts returned platform mappings", async () => {
    const mutations = mockMutations();
    queueSelectResults([
      [
        { id: 1, name: "Noodles" },
        { id: 2, name: "Drinks" },
      ],
      [
        {
          id: 101,
          categoryId: 1,
          name: "Laksa",
          description: null,
          imageUrl: null,
          isAvailable: true,
          price: 180,
        },
        {
          id: 102,
          categoryId: 2,
          name: "Tea",
          description: "Cold tea",
          imageUrl: "https://cdn.example.test/tea.jpg",
          isAvailable: true,
          price: 60,
        },
      ],
      [{ id: 901 }],
      [],
    ]);

    await expect(
      createService().syncMenu("restaurant-1", "uber_eats"),
    ).resolves.toBeUndefined();

    expect(
      mocks.integrationService.getDecryptedCredentials,
    ).toHaveBeenCalledWith("restaurant-1", "uber_eats");
    expect(mocks.adapter.syncMenu).toHaveBeenCalledWith(
      {
        restaurantId: "restaurant-1",
        categories: [
          {
            id: 1,
            name: "Noodles",
            items: [
              {
                id: 101,
                name: "Laksa",
                description: "",
                price: 180,
                imageUrl: undefined,
                available: true,
              },
            ],
          },
          {
            id: 2,
            name: "Drinks",
            items: [
              {
                id: 102,
                name: "Tea",
                description: "Cold tea",
                price: 60,
                imageUrl: "https://cdn.example.test/tea.jpg",
                available: true,
              },
            ],
          },
        ],
      },
      { accessToken: "token-1", storeId: "store-1" },
    );

    expect(mutations.updated).toHaveLength(3);
    expect(mutations.updated[0]).toMatchObject({ menuSyncStatus: "syncing" });
    expect(mutations.updated[1]).toMatchObject({
      platformItemId: "platform-101",
    });
    expect(mutations.updated[2]).toMatchObject({
      menuSyncStatus: "success",
      menuSyncError: null,
      lastMenuSyncAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        restaurantId: "restaurant-1",
        platform: "uber_eats",
        menuItemId: 102,
        platformItemId: "platform-102",
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ]);
  });

  it("marks menu sync as error and rethrows adapter failures", async () => {
    const mutations = mockMutations();
    queueSelectResults([
      [{ id: 1, name: "Noodles" }],
      [
        {
          id: 101,
          categoryId: 1,
          name: "Laksa",
          description: "Spicy",
          imageUrl: null,
          isAvailable: true,
          price: 180,
        },
      ],
    ]);
    mocks.adapter.syncMenu.mockRejectedValue(new Error("platform offline"));

    await expect(
      createService().syncMenu("restaurant-1", "uber_eats"),
    ).rejects.toThrow("platform offline");

    expect(mutations.inserted).toHaveLength(0);
    expect(mutations.updated).toHaveLength(2);
    expect(mutations.updated[0]).toMatchObject({ menuSyncStatus: "syncing" });
    expect(mutations.updated[1]).toMatchObject({
      menuSyncStatus: "error",
      menuSyncError: "platform offline",
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    });
  });
});
