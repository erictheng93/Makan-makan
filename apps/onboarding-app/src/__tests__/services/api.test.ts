/**
 * Tests for Onboarding API Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  onboardingApi,
  ApiError,
  type CreateApplicationData,
} from "@/services/api";

// Mock axios
vi.mock("axios", async () => {
  const actual = await vi.importActual("axios");
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };

  return {
    ...actual,
    default: {
      ...actual,
      create: vi.fn(() => mockInstance),
      isAxiosError: (actual as any).default?.isAxiosError || vi.fn(() => false),
    },
    __mockInstance: mockInstance,
  };
});

// Get reference to mock instance
function getMockClient() {
  const mod = axios as any;
  return mod.__mockInstance || mod.create();
}

describe("onboardingApi", () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = getMockClient();
    vi.clearAllMocks();
  });

  describe("checkSubdomain", () => {
    it("should return availability status for a valid subdomain", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            subdomain: "myrestaurant",
            available: true,
            suggestions: [],
          },
        },
      });

      const result = await onboardingApi.checkSubdomain("myrestaurant");

      expect(result.subdomain).toBe("myrestaurant");
      expect(result.available).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith(
        "/onboarding/subdomain/check",
        { params: { subdomain: "myrestaurant" } },
      );
    });

    it("should return taken status with suggestions", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            subdomain: "popular",
            available: false,
            suggestions: ["popular-1", "popular-2", "popular-restaurant"],
          },
        },
      });

      const result = await onboardingApi.checkSubdomain("popular");

      expect(result.available).toBe(false);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions).toContain("popular-1");
    });

    it("should throw ApiError on unsuccessful response", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: "Invalid subdomain format",
          code: "INVALID_FORMAT",
        },
      });

      await expect(onboardingApi.checkSubdomain("bad!name")).rejects.toThrow();
    });

    it("should throw ApiError on network failure", async () => {
      const axiosError = new Error("Network Error") as any;
      axiosError.isAxiosError = true;
      axiosError.code = undefined;
      axiosError.response = undefined;

      mockClient.get.mockRejectedValueOnce(axiosError);

      // The function calls handleApiError which checks axios.isAxiosError
      // Since we mocked axios.isAxiosError to return false, it falls through
      await expect(onboardingApi.checkSubdomain("test")).rejects.toThrow();
    });
  });

  describe("createApplication", () => {
    const validApplication: CreateApplicationData = {
      businessName: "Test Restaurant",
      contactName: "John Doe",
      contactEmail: "john@example.com",
      contactPhone: "02-1234-5678",
      planId: "standard",
      subdomain: "testrestaurant",
    };

    it("should create application successfully", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            applicationId: "app-123",
            assignedSubdomain: "testrestaurant",
            status: "submitted",
          },
        },
      });

      const result = await onboardingApi.createApplication(validApplication);

      expect(result.applicationId).toBe("app-123");
      expect(result.assignedSubdomain).toBe("testrestaurant");
      expect(result.status).toBe("submitted");
      expect(mockClient.post).toHaveBeenCalledWith(
        "/onboarding/applications",
        validApplication,
      );
    });

    it("should create application without subdomain", async () => {
      const dataWithoutSubdomain = {
        ...validApplication,
        subdomain: undefined,
      };

      mockClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            applicationId: "app-456",
            assignedSubdomain: "auto-generated-sub",
            status: "submitted",
          },
        },
      });

      const result =
        await onboardingApi.createApplication(dataWithoutSubdomain);

      expect(result.assignedSubdomain).toBe("auto-generated-sub");
    });

    it("should throw ApiError with validation details on failure", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: [
            { path: ["contactEmail"], message: "Invalid email format" },
          ],
        },
      });

      try {
        await onboardingApi.createApplication(validApplication);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiErr = error as ApiError;
        expect(apiErr.code).toBe("VALIDATION_ERROR");
        expect(apiErr.details).toHaveLength(1);
        expect(apiErr.details![0].path).toEqual(["contactEmail"]);
      }
    });
  });

  describe("getApplication", () => {
    it("should fetch application details by ID", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: "app-123",
            businessName: "Test Restaurant",
            contactName: "John Doe",
            contactEmail: "john@example.com",
            planId: "standard",
            assignedSubdomain: "testrestaurant",
            status: "submitted",
            createdAt: "2026-03-01T00:00:00Z",
          },
        },
      });

      const result = await onboardingApi.getApplication("app-123");

      expect(result.id).toBe("app-123");
      expect(result.businessName).toBe("Test Restaurant");
      expect(mockClient.get).toHaveBeenCalledWith(
        "/onboarding/applications/app-123",
      );
    });

    it("should throw ApiError when application not found", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: "Application not found",
          code: "NOT_FOUND",
        },
      });

      await expect(onboardingApi.getApplication("nonexistent")).rejects.toThrow(
        ApiError,
      );
    });
  });

  describe("verifyCloudflare", () => {
    it("should verify valid Cloudflare credentials", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            verified: true,
            permissions: {
              workers: true,
              d1: true,
              kv: true,
              r2: true,
              pages: true,
            },
          },
        },
      });

      const result = await onboardingApi.verifyCloudflare(
        "app-123",
        "a".repeat(32),
        "b".repeat(40),
      );

      expect(result.verified).toBe(true);
      expect(result.permissions.workers).toBe(true);
      expect(result.permissions.d1).toBe(true);
      expect(mockClient.post).toHaveBeenCalledWith(
        "/onboarding/applications/app-123/verify-cloudflare",
        { accountId: "a".repeat(32), apiToken: "b".repeat(40) },
      );
    });

    it("should return partial permissions when token is limited", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            verified: false,
            permissions: {
              workers: true,
              d1: false,
              kv: true,
              r2: false,
              pages: false,
            },
          },
        },
      });

      const result = await onboardingApi.verifyCloudflare(
        "app-123",
        "a".repeat(32),
        "limited-token-" + "x".repeat(30),
      );

      expect(result.verified).toBe(false);
      expect(result.permissions.d1).toBe(false);
      expect(result.permissions.r2).toBe(false);
    });

    it("should throw ApiError when verification fails", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: "Invalid API token",
          code: "CF_VERIFICATION_FAILED",
        },
      });

      await expect(
        onboardingApi.verifyCloudflare("app-123", "bad-id", "bad-token"),
      ).rejects.toThrow(ApiError);
    });
  });

  describe("completeApplication", () => {
    it("should complete application and return tenant info", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            tenantId: "tenant-abc",
            subdomain: "testrestaurant",
            status: "completed",
          },
        },
      });

      const result = await onboardingApi.completeApplication("app-123");

      expect(result.tenantId).toBe("tenant-abc");
      expect(result.subdomain).toBe("testrestaurant");
      expect(result.status).toBe("completed");
      expect(mockClient.post).toHaveBeenCalledWith(
        "/onboarding/applications/app-123/complete",
      );
    });

    it("should throw ApiError on completion failure", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: "Cloudflare not verified",
          code: "COMPLETE_FAILED",
        },
      });

      await expect(
        onboardingApi.completeApplication("app-123"),
      ).rejects.toThrow(ApiError);
    });
  });
});

describe("ApiError", () => {
  it("should create error with message and code", () => {
    const error = new ApiError("Something failed", "SOME_ERROR");

    expect(error.message).toBe("Something failed");
    expect(error.code).toBe("SOME_ERROR");
    expect(error.name).toBe("ApiError");
    expect(error.details).toBeUndefined();
  });

  it("should create error with details", () => {
    const details = [
      { path: ["email"], message: "Invalid email" },
      { path: ["name"], message: "Required" },
    ];
    const error = new ApiError(
      "Validation failed",
      "VALIDATION_ERROR",
      details,
    );

    expect(error.details).toHaveLength(2);
    expect(error.details![0].path).toEqual(["email"]);
  });

  it("should be an instance of Error", () => {
    const error = new ApiError("Test", "TEST");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });
});
