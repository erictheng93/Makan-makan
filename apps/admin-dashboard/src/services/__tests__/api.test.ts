/**
 * API Service Tests
 *
 * The ApiService creates an axios instance internally at construction time.
 * We test the public interface by mocking the underlying axios instance methods
 * via vi.mock with a factory that exposes the mock instance.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoist mock instance so vi.mock factory can reference it
const mockInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  defaults: { headers: { common: {} as Record<string, string> } },
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockInstance),
  },
}));

vi.mock("@/utils/errorHandler", () => ({
  KitchenErrorHandler: {
    handleAPIError: vi.fn((error: any) => error),
  },
}));

import { api } from "../api";

describe("ApiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset the common headers
    mockInstance.defaults.headers.common = {};
  });

  describe("setAuthToken", () => {
    it("should set Authorization header when token provided", () => {
      api.setAuthToken("test-token");

      expect(mockInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer test-token",
      );
    });

    it("should remove Authorization header when null", () => {
      mockInstance.defaults.headers.common["Authorization"] = "Bearer old";
      api.setAuthToken(null);

      expect(
        mockInstance.defaults.headers.common["Authorization"],
      ).toBeUndefined();
    });
  });

  describe("HTTP methods", () => {
    it("should call get with url and params", async () => {
      const response = { data: { success: true } };
      mockInstance.get.mockResolvedValue(response);

      const result = await api.get("/test", { id: 1 });

      expect(mockInstance.get).toHaveBeenCalledWith("/test", {
        params: { id: 1 },
      });
      expect(result).toEqual(response);
    });

    it("should call post with url and data", async () => {
      const response = { data: { success: true } };
      mockInstance.post.mockResolvedValue(response);

      const result = await api.post("/test", { name: "test" });

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/test",
        { name: "test" },
        undefined,
      );
      expect(result).toEqual(response);
    });

    it("should call post with custom headers", async () => {
      mockInstance.post.mockResolvedValue({ data: {} });

      await api.post("/test", { data: 1 }, { headers: { "X-Custom": "yes" } });

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/test",
        { data: 1 },
        { headers: { "X-Custom": "yes" } },
      );
    });

    it("should call put with url and data", async () => {
      mockInstance.put.mockResolvedValue({ data: {} });

      await api.put("/test/1", { name: "updated" });

      expect(mockInstance.put).toHaveBeenCalledWith("/test/1", {
        name: "updated",
      });
    });

    it("should call patch with url and data", async () => {
      mockInstance.patch.mockResolvedValue({ data: {} });

      await api.patch("/test/1", { status: "active" });

      expect(mockInstance.patch).toHaveBeenCalledWith("/test/1", {
        status: "active",
      });
    });

    it("should call delete with url", async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });

      await api.delete("/test/1");

      expect(mockInstance.delete).toHaveBeenCalledWith("/test/1", undefined);
    });

    it("should call delete with data when provided", async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });

      await api.delete("/test/1", { reason: "cleanup" });

      expect(mockInstance.delete).toHaveBeenCalledWith("/test/1", {
        data: { reason: "cleanup" },
      });
    });
  });

  describe("upload", () => {
    it("should post with multipart/form-data header", async () => {
      mockInstance.post.mockResolvedValue({ data: {} });

      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");

      await api.upload("/upload", formData);

      expect(mockInstance.post).toHaveBeenCalledWith("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    });
  });
});
