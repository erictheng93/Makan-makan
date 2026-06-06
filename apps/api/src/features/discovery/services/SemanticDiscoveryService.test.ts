import { describe, expect, it, vi } from "vitest";
import { SemanticDiscoveryService } from "./SemanticDiscoveryService";

describe("SemanticDiscoveryService", () => {
  function createKv() {
    const kv = new Map<string, string>();
    return {
      get: vi.fn(async (key: string, type?: "json") => {
        const value = kv.get(key);
        if (value == null) return null;
        return type === "json" ? JSON.parse(value) : value;
      }),
      put: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
      }),
    };
  }

  it("queries Vectorize with a Workers AI embedding and returns menu item ids ranked by score", async () => {
    const ai = {
      run: vi.fn(async () => ({
        data: [[0.1, 0.2, 0.3]],
        shape: [1, 3],
      })),
    };
    const vectorize = {
      query: vi.fn(async () => ({
        matches: [
          { id: "dish:42", score: 0.91 },
          { id: "dish:7", score: 0.88 },
          { id: "restaurant:ignored", score: 0.99 },
          { id: "dish:not-a-number", score: 0.77 },
        ],
        count: 4,
      })),
    };
    const service = new SemanticDiscoveryService({
      ai,
      vectorize,
      embeddingModel: "@cf/baai/bge-m3",
    });

    const result = await service.searchDishIds("想吃濃郁咖哩飯", {
      topK: 20,
      namespace: "dishes",
    });

    expect(ai.run).toHaveBeenCalledWith("@cf/baai/bge-m3", {
      text: "想吃濃郁咖哩飯",
    });
    expect(vectorize.query).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      topK: 20,
      namespace: "dishes",
      returnMetadata: "indexed",
    });
    expect(result).toEqual([
      { menuItemId: 42, score: 0.91 },
      { menuItemId: 7, score: 0.88 },
    ]);
  });

  it("caches search query embeddings by normalized query", async () => {
    const ai = {
      run: vi.fn(async () => ({
        data: [[0.4, 0.5, 0.6]],
      })),
    };
    const vectorize = {
      query: vi.fn(async () => ({
        matches: [{ id: "dish:42", score: 0.91 }],
      })),
    };
    const embeddingCache = createKv();
    const service = new SemanticDiscoveryService({
      ai,
      vectorize,
      embeddingCache,
      embeddingModel: "@cf/baai/bge-m3",
    });

    await expect(service.searchDishIds("  Curry   Rice ")).resolves.toEqual([
      { menuItemId: 42, score: 0.91 },
    ]);
    await expect(service.searchDishIds("curry rice")).resolves.toEqual([
      { menuItemId: 42, score: 0.91 },
    ]);

    expect(ai.run).toHaveBeenCalledTimes(1);
    expect(embeddingCache.put).toHaveBeenCalledTimes(1);
    expect(vectorize.query).toHaveBeenCalledTimes(2);
    expect(vectorize.query).toHaveBeenNthCalledWith(2, [0.4, 0.5, 0.6], {
      topK: 50,
      namespace: "dishes",
      returnMetadata: "indexed",
    });
  });

  it("fails closed when semantic bindings are missing or unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = new SemanticDiscoveryService({});
    await expect(missing.searchDishIds("咖哩")).resolves.toEqual([]);

    const broken = new SemanticDiscoveryService({
      ai: {
        run: vi.fn(async () => {
          throw new Error("workers ai unavailable");
        }),
      },
      vectorize: {
        query: vi.fn(),
      },
    });

    await expect(broken.searchDishIds("咖哩")).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "semanticDiscovery.search.failed",
      expect.any(Object),
    );
    warn.mockRestore();
  });

  it("upserts dish vectors with searchable metadata", async () => {
    const ai = {
      run: vi.fn(async () => ({
        data: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      })),
    };
    const vectorize = {
      query: vi.fn(),
      upsert: vi.fn(async () => ({ mutationId: "mutation-1" })),
    };
    const service = new SemanticDiscoveryService({ ai, vectorize });

    const result = await service.upsertDishes([
      {
        menuItemId: 42,
        restaurantId: "restaurant-1",
        text: "咖哩飯 主食 日式",
        catalogType: "menu_item",
        primaryMarketId: "market-1",
      },
      {
        menuItemId: 7,
        restaurantId: "restaurant-2",
        text: "甜點 布丁",
        catalogType: "product",
        primaryMarketId: null,
      },
    ]);

    expect(ai.run).toHaveBeenCalledWith("@cf/baai/bge-m3", {
      text: ["咖哩飯 主食 日式", "甜點 布丁"],
    });
    expect(vectorize.upsert).toHaveBeenCalledWith([
      {
        id: "dish:42",
        namespace: "dishes",
        values: [0.1, 0.2, 0.3],
        metadata: {
          menuItemId: 42,
          restaurantId: "restaurant-1",
          catalogType: "menu_item",
          primaryMarketId: "market-1",
        },
      },
      {
        id: "dish:7",
        namespace: "dishes",
        values: [0.4, 0.5, 0.6],
        metadata: {
          menuItemId: 7,
          restaurantId: "restaurant-2",
          catalogType: "product",
        },
      },
    ]);
    expect(result).toEqual({ upserted: 2 });
  });
});
