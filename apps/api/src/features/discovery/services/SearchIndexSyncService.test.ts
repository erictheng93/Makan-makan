import { beforeEach, describe, expect, it, vi } from "vitest";

let whereRows: unknown[] = [];
let selectRows: unknown[][] = [];
let selectDistinctRows: unknown[][] = [];
const updateMock = vi.fn();
const deleteMock = vi.fn();
const insertMock = vi.fn();
const updatedRows: unknown[] = [];
const insertedRows: unknown[] = [];
const deletedRows: unknown[] = [];

function query(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fakeDb = {
  select: vi.fn(() => query(selectRows.shift() ?? whereRows)),
  selectDistinct: vi.fn(() => query(selectDistinctRows.shift() ?? [])),
  delete: deleteMock.mockImplementation(() => ({
    where: vi.fn((condition: unknown) => {
      deletedRows.push(condition);
      return Promise.resolve();
    }),
  })),
  insert: insertMock.mockImplementation(() => ({
    values: vi.fn((payload: unknown) => {
      insertedRows.push(payload);
      return Promise.resolve();
    }),
  })),
  update: updateMock.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updatedRows.push(payload);
        return builder;
      }),
      where: vi.fn(() => Promise.resolve()),
    };
    return builder;
  }),
};

vi.mock("drizzle-orm/d1", () => ({ drizzle: () => fakeDb }));

import { SearchIndexSyncService } from "./SearchIndexSyncService";

function makeKv() {
  return {
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  } as unknown as KVNamespace;
}

type QueueBatch = Array<{ body: unknown }>;
function makeQueue() {
  return {
    send: vi.fn((_body: unknown) => Promise.resolve()),
    sendBatch: vi.fn((_batch: QueueBatch) => Promise.resolve()),
  };
}

const d1 = {} as unknown as D1Database;

describe("SearchIndexSyncService fan-out queue", () => {
  beforeEach(() => {
    whereRows = [];
    selectRows = [];
    selectDistinctRows = [];
    updatedRows.length = 0;
    insertedRows.length = 0;
    deletedRows.length = 0;
    vi.useRealTimers();
    updateMock.mockClear();
    deleteMock.mockClear();
    insertMock.mockClear();
  });

  it("onMarketChanged enqueues one restaurant message per member, not inline", async () => {
    whereRows = [{ restaurantId: "r1" }, { restaurantId: "r2" }];
    const queue = makeQueue();
    const kv = makeKv();
    const svc = new SearchIndexSyncService(d1, kv, queue as never);

    await svc.onMarketChanged("market-1");

    expect(queue.sendBatch).toHaveBeenCalledOnce();
    expect(queue.sendBatch).toHaveBeenCalledWith([
      { body: { type: "restaurant", restaurantId: "r1" } },
      { body: { type: "restaurant", restaurantId: "r2" } },
    ]);
    expect(updateMock).not.toHaveBeenCalled();
    expect(kv.put).toHaveBeenCalled();
  });

  it("onCategoryChanged enqueues one menuItem message per item", async () => {
    whereRows = [{ id: 11 }, { id: 22 }];
    const queue = makeQueue();
    const svc = new SearchIndexSyncService(d1, makeKv(), queue as never);

    await svc.onCategoryChanged(5);

    expect(queue.sendBatch).toHaveBeenCalledWith([
      { body: { type: "menuItem", menuItemId: 11 } },
      { body: { type: "menuItem", menuItemId: 22 } },
    ]);
  });

  it("chunks fan-out into batches of at most 100 messages", async () => {
    whereRows = Array.from({ length: 150 }, (_, i) => ({
      restaurantId: `r${i}`,
    }));
    const queue = makeQueue();
    const svc = new SearchIndexSyncService(d1, makeKv(), queue as never);

    await svc.onMarketChanged("market-big");

    expect(queue.sendBatch).toHaveBeenCalledTimes(2);
    expect(queue.sendBatch.mock.calls[0][0]).toHaveLength(100);
    expect(queue.sendBatch.mock.calls[1][0]).toHaveLength(50);
  });

  it("processMessage dispatches to the matching single-entity handler", async () => {
    const svc = new SearchIndexSyncService(d1, makeKv());
    const onRestaurant = vi
      .spyOn(svc, "onRestaurantChanged")
      .mockResolvedValue(undefined);
    const onMenuItem = vi
      .spyOn(svc, "onMenuItemChanged")
      .mockResolvedValue(undefined);

    await svc.processMessage({ type: "restaurant", restaurantId: "r9" });
    await svc.processMessage({ type: "menuItem", menuItemId: 42 });

    expect(onRestaurant).toHaveBeenCalledWith("r9");
    expect(onMenuItem).toHaveBeenCalledWith(42);
  });

  it("without a queue, onMarketChanged stays on the inline path", async () => {
    whereRows = [];
    const svc = new SearchIndexSyncService(d1, makeKv());

    await expect(svc.onMarketChanged("market-empty")).resolves.toBeUndefined();
  });

  it("removes stale index rows when a changed menu item no longer exists", async () => {
    selectRows = [[]];
    const kv = makeKv();
    const svc = new SearchIndexSyncService(d1, kv);

    await svc.onMenuItemChanged(42);

    expect(deleteMock).toHaveBeenCalledOnce();
    expect(insertMock).not.toHaveBeenCalled();
    expect(deletedRows).toHaveLength(1);
    expect(kv.put).toHaveBeenCalledWith(
      "search:query:version",
      expect.any(String),
    );
    expect(kv.put).toHaveBeenCalledWith("markets:version", expect.any(String));
  });

  it("denormalizes menu items into the search index with parsed markets and tags", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    selectRows = [
      [
        {
          id: 42,
          name: "  Nasi   Lemak ",
          price: 80.5,
          priceCents: null,
          catalogType: null,
          isAvailable: true,
          tags: ["rice", " spicy "],
          keywords: "coconut, breakfast",
          deletedAt: null,
          restaurantId: "restaurant-1",
          categoryName: "Rice",
          categoryActive: true,
          categoryVisible: true,
          categoryDeleted: null,
          district: "Central",
          restaurantType: "malaysian",
          supportsTakeaway: true,
          supportsDelivery: false,
          restaurantActive: true,
          restaurantDeleted: null,
          latitude: 25.1,
          longitude: 121.5,
          marketIds: '["market-1","market-2"]',
          primaryMarketId: "market-1",
        },
      ],
    ];
    const svc = new SearchIndexSyncService(d1, makeKv());

    await svc.onMenuItemChanged(42);

    expect(deleteMock).toHaveBeenCalledOnce();
    expect(insertedRows).toEqual([
      expect.objectContaining({
        menuItemId: 42,
        restaurantId: "restaurant-1",
        dishName: "  Nasi   Lemak ",
        dishNameNormalized: "nasilemak",
        categoryName: "Rice",
        price: 80.5,
        priceCents: 8050,
        catalogType: "menu_item",
        isAvailable: true,
        tags: ["rice", "spicy", "coconut", "breakfast"],
        district: "Central",
        restaurantType: "malaysian",
        supportsTakeaway: true,
        supportsDelivery: false,
        primaryMarketId: "market-1",
        marketIds: ["market-1", "market-2"],
        latitude: 25.1,
        longitude: 121.5,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ]);
  });

  it("marks inactive restaurants unavailable and invalidates affected district caches", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    selectDistinctRows = [[{ district: "Old Town" }]];
    selectRows = [
      [
        {
          district: "Central",
          type: "malaysian",
          supportsTakeaway: true,
          supportsDelivery: true,
          latitude: 25.1,
          longitude: 121.5,
          isActive: false,
          marketIds: null,
          primaryMarketId: null,
          deletedAt: null,
        },
      ],
    ];
    const kv = makeKv();
    const svc = new SearchIndexSyncService(d1, kv);

    await svc.onRestaurantChanged("restaurant-1", {
      previousDistrict: "Previous",
    });

    expect(updatedRows).toEqual([
      {
        isAvailable: false,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ]);
    expect(kv.delete).toHaveBeenCalledWith(
      "search:restaurants:district:Old Town",
    );
    expect(kv.delete).toHaveBeenCalledWith(
      "search:restaurants:district:Previous",
    );
    expect(kv.delete).toHaveBeenCalledWith(
      "search:restaurants:district:Central",
    );
    expect(kv.put).toHaveBeenCalledWith(
      "search:query:version",
      expect.any(String),
    );
  });
});
