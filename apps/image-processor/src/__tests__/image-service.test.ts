/**
 * Tests for ImageService (database operations and metadata management)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnv } from "./setup";

// Create a shared mock object that persists across test runs
const mockDbService = {
  createImage: vi.fn(async () => ({ id: "generated-uuid-v7" })),
  getImage: vi.fn(async () => null),
  updateImage: vi.fn(async () => ({})),
  deleteImage: vi.fn(async () => ({})),
  getImagesCount: vi.fn(async () => 0),
  getImages: vi.fn(async () => []),
  createProcessingJob: vi.fn(async () => ({ id: 123, createdAt: new Date() })),
  updateProcessingJobStatus: vi.fn(async () => ({})),
  getProcessingJob: vi.fn(async () => null),
  getImageAnalyticsSummary: vi.fn(async () => ({
    total_images: 0,
    total_storage: 0,
  })),
  getCategoryStats: vi.fn(async () => []),
  getJobStats: vi.fn(async () => []),
  recordImageView: vi.fn(async () => ({})),
  getStorageAnalytics: vi.fn(async () => ({})),
  getUsageAnalytics: vi.fn(async () => ({})),
  getPerformanceAnalytics: vi.fn(async () => ({})),
};

// Mock the @makanmakan/database module
vi.mock("@makanmakan/database", () => {
  // Use a class so it can be used with `new`
  class MockImageService {
    constructor(..._args: any[]) {
      return mockDbService as any;
    }
  }

  return {
    ImageService: MockImageService,
    createDatabase: vi.fn(),
    sql: vi.fn(),
    count: vi.fn(),
    eq: vi.fn(),
    images: {},
    imageViews: {},
    imageProcessingJobs: {},
  };
});

// Import AFTER mock is set up
import { ImageService } from "../services/image-service";

describe("ImageService", () => {
  let env: ReturnType<typeof createMockEnv>;
  let service: ImageService;

  beforeEach(() => {
    env = createMockEnv();
    // Reset all mock call history but keep implementations
    Object.values(mockDbService).forEach((fn) => {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as any).mockClear();
      }
    });

    // Reset default implementations
    mockDbService.createImage.mockResolvedValue({ id: "generated-uuid-v7" });
    mockDbService.createProcessingJob.mockResolvedValue({
      id: 123,
      createdAt: new Date(),
    });
    mockDbService.getImage.mockResolvedValue(null);
    mockDbService.getImagesCount.mockResolvedValue(0);
    mockDbService.getImages.mockResolvedValue([]);
    mockDbService.getProcessingJob.mockResolvedValue(null);
    mockDbService.getImageAnalyticsSummary.mockResolvedValue({
      total_images: 0,
      total_storage: 0,
    });
    mockDbService.getCategoryStats.mockResolvedValue([]);
    mockDbService.getJobStats.mockResolvedValue([]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    service = new ImageService(env as any);
  });

  // ── saveImageMetadata ────────────────────────────────────────

  describe("saveImageMetadata", () => {
    it("should save metadata and cache the result", async () => {
      const metadata = {
        filename: "test-123.jpg",
        originalFilename: "photo.jpg",
        mimeType: "image/jpeg",
        size: 1024000,
        width: 800,
        height: 600,
        variants: {} as any,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 1,
        restaurantId: 100,
        category: "menu",
        tags: ["food", "spicy"],
        altText: "A spicy dish",
      };

      const result = await service.saveImageMetadata(metadata);

      expect(result.success).toBe(true);
      expect(result.id).toBe("generated-uuid-v7");
      expect(mockDbService.createImage).toHaveBeenCalledOnce();

      // Verify cache was populated
      const cached = await env.IMAGE_CACHE.get("image:generated-uuid-v7");
      expect(cached).not.toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      mockDbService.createImage.mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      const result = await service.saveImageMetadata({
        filename: "test.jpg",
        originalFilename: "test.jpg",
        mimeType: "image/jpeg",
        size: 1000,
        variants: {} as any,
        uploadedAt: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("DB connection failed");
    });
  });

  // ── getImageMetadata ─────────────────────────────────────────

  describe("getImageMetadata", () => {
    it("should return cached metadata when available", async () => {
      const cachedData = {
        id: "img-123",
        filename: "test.jpg",
        originalFilename: "original.jpg",
        mimeType: "image/jpeg",
        size: 5000,
        variants: { original: "https://cdn.example.com/img-123/original" },
        uploadedAt: "2025-01-01T00:00:00Z",
      };

      await env.IMAGE_CACHE.put("image:img-123", JSON.stringify(cachedData));

      const result = await service.getImageMetadata("img-123");

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("img-123");
      expect(mockDbService.getImage).not.toHaveBeenCalled();
    });

    it("should fetch from database when not cached", async () => {
      mockDbService.getImage.mockResolvedValueOnce({
        id: "img-456",
        filename: "photo.jpg",
        originalFilename: "original-photo.jpg",
        mimeType: "image/jpeg",
        size: 10000,
        width: 1024,
        height: 768,
        variants: JSON.stringify({ original: "url" }),
        uploadedAt: new Date(),
        uploadedBy: 1,
        restaurantId: "100",
        category: "food",
        metadata: JSON.stringify({ tags: ["tasty"] }),
      });

      const result = await service.getImageMetadata("img-456");

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("img-456");
      expect(result.data?.width).toBe(1024);
      expect(mockDbService.getImage).toHaveBeenCalledWith("img-456");

      // Should have been cached
      const cached = await env.IMAGE_CACHE.get("image:img-456");
      expect(cached).not.toBeNull();
    });

    it("should return error for non-existent image", async () => {
      const result = await service.getImageMetadata("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Image not found");
    });

    it("should handle database errors", async () => {
      mockDbService.getImage.mockRejectedValueOnce(new Error("Query failed"));

      const result = await service.getImageMetadata("img-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Query failed");
    });
  });

  // ── updateImageMetadata ──────────────────────────────────────

  describe("updateImageMetadata", () => {
    it("should update metadata and invalidate cache", async () => {
      // Pre-populate cache
      await env.IMAGE_CACHE.put(
        "image:img-123",
        JSON.stringify({ id: "img-123" }),
      );

      const result = await service.updateImageMetadata("img-123", {
        altText: "Updated alt text",
        category: "drinks",
      });

      expect(result.success).toBe(true);
      expect(mockDbService.updateImage).toHaveBeenCalled();

      // Cache should be invalidated
      const cached = await env.IMAGE_CACHE.get("image:img-123");
      expect(cached).toBeNull();
    });

    it("should return error when no fields to update", async () => {
      const result = await service.updateImageMetadata("img-123", {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No fields to update");
    });

    it("should handle database errors", async () => {
      mockDbService.updateImage.mockRejectedValueOnce(
        new Error("Update failed"),
      );

      const result = await service.updateImageMetadata("img-123", {
        category: "new",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Update failed");
    });
  });

  // ── deleteImageMetadata ──────────────────────────────────────

  describe("deleteImageMetadata", () => {
    it("should delete metadata and remove from cache", async () => {
      await env.IMAGE_CACHE.put(
        "image:img-123",
        JSON.stringify({ id: "img-123" }),
      );

      const result = await service.deleteImageMetadata("img-123");

      expect(result.success).toBe(true);
      expect(mockDbService.deleteImage).toHaveBeenCalledWith("img-123");

      const cached = await env.IMAGE_CACHE.get("image:img-123");
      expect(cached).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDbService.deleteImage.mockRejectedValueOnce(
        new Error("Delete failed"),
      );

      const result = await service.deleteImageMetadata("img-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Delete failed");
    });
  });

  // ── listImages ───────────────────────────────────────────────

  describe("listImages", () => {
    it("should return paginated image list", async () => {
      mockDbService.getImagesCount.mockResolvedValueOnce(50);
      mockDbService.getImages.mockResolvedValueOnce([
        {
          id: "img-1",
          filename: "photo1.jpg",
          original_filename: "photo1.jpg",
          mime_type: "image/jpeg",
          size: 1000,
          variants: "[]",
          uploaded_at: "2025-01-01",
        },
      ]);

      const result = await service.listImages({
        page: 1,
        limit: 20,
        restaurantId: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(50);
      expect(result.data?.images).toHaveLength(1);
    });

    it("should use default options when none provided", async () => {
      const result = await service.listImages();

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(0);
      expect(result.data?.images).toHaveLength(0);
    });

    it("should handle database errors", async () => {
      mockDbService.getImagesCount.mockRejectedValueOnce(
        new Error("Query failed"),
      );

      const result = await service.listImages();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Query failed");
    });
  });

  // ── createProcessingJob ──────────────────────────────────────

  describe("createProcessingJob", () => {
    it("should create a job and cache it", async () => {
      const result = await service.createProcessingJob(
        "img-123",
        [{ type: "resize", width: 400 }],
        ["thumbnail"],
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.jobId).toBe("123");

      // Should be cached
      const cached = await env.IMAGE_CACHE.get(`job:${result.jobId}`);
      expect(cached).not.toBeNull();
      const job = JSON.parse(cached!);
      expect(job.status).toBe("pending");
      expect(job.imageId).toBe("img-123");
    });

    it("should handle database errors", async () => {
      mockDbService.createProcessingJob.mockRejectedValueOnce(
        new Error("Job creation failed"),
      );

      const result = await service.createProcessingJob("img-123", [], []);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Job creation failed");
    });
  });

  // ── updateJobStatus ──────────────────────────────────────────

  describe("updateJobStatus", () => {
    it("should update job status and cache", async () => {
      const jobData = {
        id: "1",
        imageId: "img-123",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await env.IMAGE_CACHE.put("job:1", JSON.stringify(jobData));

      const result = await service.updateJobStatus("1", "processing", 50);

      expect(result.success).toBe(true);

      const cached = JSON.parse((await env.IMAGE_CACHE.get("job:1"))!);
      expect(cached.status).toBe("processing");
      expect(cached.progress).toBe(50);
    });

    it("should set completedAt when status is completed", async () => {
      const jobData = { id: "1", status: "processing" };
      await env.IMAGE_CACHE.put("job:1", JSON.stringify(jobData));

      await service.updateJobStatus("1", "completed", 100);

      const cached = JSON.parse((await env.IMAGE_CACHE.get("job:1"))!);
      expect(cached.status).toBe("completed");
      expect(cached.completedAt).toBeDefined();
    });

    it("should store error message on failure status", async () => {
      const jobData = { id: "1", status: "processing" };
      await env.IMAGE_CACHE.put("job:1", JSON.stringify(jobData));

      await service.updateJobStatus(
        "1",
        "failed",
        undefined,
        "Processing timed out",
      );

      const cached = JSON.parse((await env.IMAGE_CACHE.get("job:1"))!);
      expect(cached.status).toBe("failed");
      expect(cached.error).toBe("Processing timed out");
    });
  });

  // ── getJobStatus ─────────────────────────────────────────────

  describe("getJobStatus", () => {
    it("should return cached job when available", async () => {
      const jobData = {
        id: "1",
        imageId: "img-123",
        status: "completed",
        progress: 100,
      };
      await env.IMAGE_CACHE.put("job:1", JSON.stringify(jobData));

      const result = await service.getJobStatus("1");

      expect(result.success).toBe(true);
      expect(result.job?.status).toBe("completed");
      expect(mockDbService.getProcessingJob).not.toHaveBeenCalled();
    });

    it("should fetch from database when not cached", async () => {
      mockDbService.getProcessingJob.mockResolvedValueOnce({
        id: "job-2",
        imageId: "img-456",
        status: "processing",
        inputParams: JSON.stringify({
          transformations: [{ type: "resize" }],
          variants: ["thumbnail"],
        }),
        createdAt: new Date(),
        completedAt: null,
        error: null,
        outputData: JSON.stringify({ progress: 50 }),
      });

      const result = await service.getJobStatus("2");

      expect(result.success).toBe(true);
      expect(result.job?.status).toBe("processing");
      expect(result.job?.progress).toBe(50);
    });

    it("should return error for non-existent job", async () => {
      const result = await service.getJobStatus("999");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Job not found");
    });
  });

  // ── getImageAnalytics ────────────────────────────────────────

  describe("getImageAnalytics", () => {
    it("should return analytics summary", async () => {
      mockDbService.getImageAnalyticsSummary.mockResolvedValueOnce({
        total_images: 100,
        total_storage: 50000000,
      });
      mockDbService.getCategoryStats.mockResolvedValueOnce([
        { category: "menu", count: 60 },
        { category: "restaurant", count: 40 },
      ]);
      mockDbService.getJobStats.mockResolvedValueOnce([
        { status: "completed", count: 80, avg_duration: 250 },
        { status: "failed", count: 5, avg_duration: null },
      ]);

      const result = await service.getImageAnalytics({ restaurantId: 100 });

      expect(result.success).toBe(true);
      expect(result.analytics?.totalImages).toBe(100);
      expect(result.analytics?.totalSize).toBe(50000000);
      expect(result.analytics?.uploadsByCategory).toHaveLength(2);
      expect(result.analytics?.avgProcessingTime).toBe(250);
      // Error rate: 5 / 85 * 100
      expect(result.analytics?.errorRate).toBeCloseTo(5.88, 1);
    });

    it("should handle empty analytics gracefully", async () => {
      mockDbService.getImageAnalyticsSummary.mockResolvedValueOnce(null);
      mockDbService.getCategoryStats.mockResolvedValueOnce([]);
      mockDbService.getJobStats.mockResolvedValueOnce([]);

      const result = await service.getImageAnalytics();

      expect(result.success).toBe(true);
      expect(result.analytics?.totalImages).toBe(0);
      expect(result.analytics?.errorRate).toBe(0);
    });

    it("should handle database errors", async () => {
      mockDbService.getImageAnalyticsSummary.mockRejectedValueOnce(
        new Error("Analytics query failed"),
      );

      const result = await service.getImageAnalytics();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Analytics query failed");
    });
  });

  // ── recordImageView ──────────────────────────────────────────

  describe("recordImageView", () => {
    it("should call database service to record view", async () => {
      await service.recordImageView("img-123", "thumbnail");

      expect(mockDbService.recordImageView).toHaveBeenCalledWith({
        imageId: "img-123",
        variant: "thumbnail",
      });
    });

    it("should default to original variant", async () => {
      await service.recordImageView("img-123");

      expect(mockDbService.recordImageView).toHaveBeenCalledWith({
        imageId: "img-123",
        variant: "original",
      });
    });

    it("should not throw on errors (fire and forget)", async () => {
      mockDbService.recordImageView.mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(service.recordImageView("img-123")).resolves.toBeUndefined();
    });
  });
});
