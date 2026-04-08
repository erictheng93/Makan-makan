import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosInstance } from "axios";

const mockDedupe = vi.fn((_key: string, fn: () => Promise<any>) => fn());
const mockInvalidate = vi.fn();
const mockClear = vi.fn();

vi.mock("../request-deduplication", () => {
  return {
    RequestDeduplicator: class MockRequestDeduplicator {
      constructor(public options: any) {}
      dedupe = mockDedupe;
      invalidate = mockInvalidate;
      clear = mockClear;
    },
  };
});

import {
  installAxiosDeduplication,
  skipDedup,
  withDedupTTL,
  combineConfigs,
} from "../axios-deduplication-interceptor";

function createMockAxiosInstance(): AxiosInstance {
  const interceptors = {
    request: { use: vi.fn().mockReturnValue(1), eject: vi.fn() },
    response: { use: vi.fn().mockReturnValue(2), eject: vi.fn() },
  };

  return {
    interceptors,
    get: vi.fn().mockResolvedValue({ data: "get-response" }),
    post: vi.fn().mockResolvedValue({ data: "post-response" }),
    put: vi.fn().mockResolvedValue({ data: "put-response" }),
    patch: vi.fn().mockResolvedValue({ data: "patch-response" }),
    delete: vi.fn().mockResolvedValue({ data: "delete-response" }),
  } as unknown as AxiosInstance;
}

describe("axios-deduplication-interceptor", () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance = createMockAxiosInstance();
  });

  describe("installAxiosDeduplication", () => {
    it("should register request and response interceptors", () => {
      installAxiosDeduplication(axiosInstance);

      expect(axiosInstance.interceptors.request.use).toHaveBeenCalledOnce();
      expect(axiosInstance.interceptors.response.use).toHaveBeenCalledOnce();
    });

    it("should return a cleanup function", () => {
      const cleanup = installAxiosDeduplication(axiosInstance);
      expect(typeof cleanup).toBe("function");
    });

    it("cleanup should eject interceptors and restore original methods", () => {
      const originalGet = axiosInstance.get;
      const cleanup = installAxiosDeduplication(axiosInstance);

      // Methods are now wrapped
      expect(axiosInstance.get).not.toBe(originalGet);

      cleanup();

      // Interceptors ejected
      expect(axiosInstance.interceptors.request.eject).toHaveBeenCalledWith(1);
      expect(axiosInstance.interceptors.response.eject).toHaveBeenCalledWith(2);
      // Deduplicator cleared
      expect(mockClear).toHaveBeenCalledOnce();
    });
  });

  describe("GET deduplication", () => {
    it("should call deduplicator.dedupe for GET requests", async () => {
      installAxiosDeduplication(axiosInstance);
      await axiosInstance.get("/users");

      expect(mockDedupe).toHaveBeenCalledWith(
        expect.stringContaining("get:/users"),
        expect.any(Function),
        expect.objectContaining({}),
      );
    });
  });

  describe("POST deduplication", () => {
    it("should call deduplicator.dedupe for POST with 1s default TTL", async () => {
      installAxiosDeduplication(axiosInstance);
      await axiosInstance.post("/orders", { item: "nasi lemak" });

      expect(mockDedupe).toHaveBeenCalledWith(
        expect.stringContaining("post:/orders"),
        expect.any(Function),
        expect.objectContaining({ ttl: 1000 }),
      );
    });
  });

  describe("PUT deduplication", () => {
    it("should call deduplicator.dedupe for PUT with 1s default TTL", async () => {
      installAxiosDeduplication(axiosInstance);
      await axiosInstance.put("/orders/1", { status: "completed" });

      expect(mockDedupe).toHaveBeenCalledWith(
        expect.stringContaining("put:/orders/1"),
        expect.any(Function),
        expect.objectContaining({ ttl: 1000 }),
      );
    });
  });

  describe("PATCH deduplication", () => {
    it("should call deduplicator.dedupe for PATCH with 1s default TTL", async () => {
      installAxiosDeduplication(axiosInstance);
      await axiosInstance.patch("/orders/1", { notes: "extra spicy" });

      expect(mockDedupe).toHaveBeenCalledWith(
        expect.stringContaining("patch:/orders/1"),
        expect.any(Function),
        expect.objectContaining({ ttl: 1000 }),
      );
    });
  });

  describe("DELETE — no deduplication", () => {
    it("should NOT deduplicate DELETE requests", async () => {
      installAxiosDeduplication(axiosInstance);
      mockDedupe.mockClear();

      await axiosInstance.delete("/orders/1");

      expect(mockDedupe).not.toHaveBeenCalled();
    });
  });

  describe("skipDedup", () => {
    it("should return a config object", () => {
      const config = skipDedup();
      expect(typeof config).toBe("object");
    });
  });

  describe("withDedupTTL", () => {
    it("should return config with dedupTTL", () => {
      const config = withDedupTTL(30000);
      expect((config as any).dedupTTL).toBe(30000);
    });
  });

  describe("combineConfigs", () => {
    it("should merge multiple configs", () => {
      const combined = combineConfigs(withDedupTTL(10000), {
        headers: { "X-Custom": "value" },
      });
      expect((combined as any).dedupTTL).toBe(10000);
      expect(combined.headers).toEqual({ "X-Custom": "value" });
    });

    it("should handle empty configs", () => {
      const combined = combineConfigs({}, {});
      expect(combined).toEqual({});
    });

    it("should let later configs override earlier ones", () => {
      const combined = combineConfigs({ timeout: 1000 }, { timeout: 5000 });
      expect(combined.timeout).toBe(5000);
    });
  });
});
