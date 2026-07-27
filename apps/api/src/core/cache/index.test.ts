import { describe, expect, it, vi } from "vitest";
import { KVCacheService } from ".";

describe("KVCacheService.clear", () => {
  it("treats a trailing wildcard as a prefix and deletes every result page", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        keys: [
          { name: "restaurants:list" },
          { name: "restaurants:list:limit:20:page:1" },
        ],
        list_complete: false,
        cursor: "next-page",
        cacheStatus: null,
      })
      .mockResolvedValueOnce({
        keys: [{ name: "restaurants:list:type:onboarding" }],
        list_complete: true,
        cacheStatus: null,
      });
    const deleteKey = vi.fn().mockResolvedValue(undefined);
    const kv = {
      list,
      delete: deleteKey,
    } as unknown as KVNamespace;

    await new KVCacheService(kv).clear("restaurants:list*");

    expect(list).toHaveBeenNthCalledWith(1, {
      prefix: "restaurants:list",
      cursor: undefined,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      prefix: "restaurants:list",
      cursor: "next-page",
    });
    expect(deleteKey.mock.calls.map(([key]) => key)).toEqual([
      "restaurants:list",
      "restaurants:list:limit:20:page:1",
      "restaurants:list:type:onboarding",
    ]);
  });
});
