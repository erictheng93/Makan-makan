import { describe, it, expect, beforeEach, vi } from "vitest";

// The fan-out branch under test only needs db.select(...).from(...).where()
// to resolve to membership/item rows. We mock the drizzle d1 builder so the
// test focuses on enqueue behavior, not query construction.
let whereRows: unknown[] = [];
const updateMock = vi.fn();
const fakeDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(whereRows)),
    })),
  })),
  // Present so that if the inline (non-queue) path were taken by mistake,
  // the test would observe a call here instead of silently passing.
  update: updateMock,
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
    updateMock.mockClear();
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
    // Inline path (which would call db.update on each restaurant) must not run.
    expect(updateMock).not.toHaveBeenCalled();
    // Readers get an immediate freshness signal.
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
    // No member restaurants → inline Promise.all over an empty list, no throw.
    await expect(svc.onMarketChanged("market-empty")).resolves.toBeUndefined();
  });
});
