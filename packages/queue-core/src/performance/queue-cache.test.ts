import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueCache } from "./queue-cache";

describe("QueueCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached entries until their ttl expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const cache = new QueueCache({ queuePositionTtl: 1_000 });
    const key = {
      type: "position" as const,
      restaurantId: 1,
      identifier: "q1",
    };

    cache.set(key, { currentPosition: 2 });
    expect(cache.get(key)).toEqual({ currentPosition: 2 });

    vi.advanceTimersByTime(1_001);
    expect(cache.get(key)).toBeNull();
  });

  it("invalidates all entries for a restaurant", () => {
    const cache = new QueueCache();
    cache.set({ type: "status", restaurantId: 1 }, { size: 2 });
    cache.set({ type: "status", restaurantId: 2 }, { size: 4 });

    cache.invalidateRestaurant(1);

    expect(cache.get({ type: "status", restaurantId: 1 })).toBeNull();
    expect(cache.get({ type: "status", restaurantId: 2 })).toEqual({
      size: 4,
    });
  });
});
