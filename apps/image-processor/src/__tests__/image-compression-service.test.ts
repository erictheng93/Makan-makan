/**
 * Tests for ImageCompressionService
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageCompressionService } from "../services/ImageCompressionService";
import { createJPEGBuffer, createPNGBuffer, createWebPBuffer } from "./setup";

describe("ImageCompressionService", () => {
  let service: ImageCompressionService;

  beforeEach(() => {
    service = new ImageCompressionService({
      accountId: "test-account",
      apiToken: "test-token",
      deliveryUrl: "https://imagedelivery.net/test-hash",
    });
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // ── uploadAndCompress ────────────────────────────────────────

  describe("uploadAndCompress", () => {
    it("should upload image and return result", async () => {
      const mockResult = {
        id: "uploaded-123",
        filename: "test.jpg",
        uploaded: new Date().toISOString(),
        requireSignedURLs: false,
        variants: ["public"],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ result: mockResult }),
        }),
      );

      const buffer = new ArrayBuffer(100);
      const result = await service.uploadAndCompress(buffer);

      expect(result.id).toBe("uploaded-123");
      expect(result.variants).toContain("public");
    });

    it("should pass metadata with upload", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              id: "img-1",
              filename: "f",
              uploaded: "",
              requireSignedURLs: false,
              variants: [],
            },
          }),
        }),
      );

      await service.uploadAndCompress(new ArrayBuffer(10), {
        requireSignedURLs: true,
        metadata: { category: "menu" },
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[1]?.method).toBe("POST");
    });

    it("should throw on API failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: "Forbidden",
        }),
      );

      await expect(
        service.uploadAndCompress(new ArrayBuffer(10)),
      ).rejects.toThrow("Failed to upload image: Forbidden");
    });
  });

  // ── generateMenuItemVariants ─────────────────────────────────

  describe("generateMenuItemVariants", () => {
    it("should generate all predefined menu item variants", async () => {
      const variants = await service.generateMenuItemVariants("img-123");

      expect(variants).toHaveProperty("thumbnail");
      expect(variants).toHaveProperty("small");
      expect(variants).toHaveProperty("medium");
      expect(variants).toHaveProperty("large");
      expect(variants).toHaveProperty("thumbnail-webp");
      expect(variants).toHaveProperty("medium-webp");
    });

    it("should include correct dimension parameters in URLs", async () => {
      const variants = await service.generateMenuItemVariants("img-123");

      expect(variants.thumbnail).toContain("w=150");
      expect(variants.thumbnail).toContain("h=150");
      expect(variants.large).toContain("w=1280");
      expect(variants["medium-webp"]).toContain("f=webp");
    });

    it("should include the image ID in all URLs", async () => {
      const variants = await service.generateMenuItemVariants("my-image-id");

      Object.values(variants).forEach((url) => {
        expect(url).toContain("my-image-id");
      });
    });

    it("should base URLs on deliveryUrl config", async () => {
      const variants = await service.generateMenuItemVariants("img-1");

      Object.values(variants).forEach((url) => {
        expect(url.startsWith("https://imagedelivery.net/test-hash/")).toBe(
          true,
        );
      });
    });
  });

  // ── analyzeCompression ───────────────────────────────────────

  describe("analyzeCompression", () => {
    it("should calculate compression metrics correctly", async () => {
      const original = new ArrayBuffer(10000);
      const compressed = new ArrayBuffer(3000);

      const metrics = await service.analyzeCompression(original, compressed);

      expect(metrics.originalSize).toBe(10000);
      expect(metrics.compressedSize).toBe(3000);
      expect(metrics.savings).toBe(7000);
      expect(metrics.savingsPercentage).toBe(70);
      expect(metrics.compressionRatio).toBeCloseTo(3.333, 2);
    });

    it("should handle no compression (same size)", async () => {
      const buf = new ArrayBuffer(5000);

      const metrics = await service.analyzeCompression(buf, buf);

      expect(metrics.savings).toBe(0);
      expect(metrics.savingsPercentage).toBe(0);
      expect(metrics.compressionRatio).toBe(1);
    });

    it("should handle negative compression (larger output)", async () => {
      const original = new ArrayBuffer(1000);
      const larger = new ArrayBuffer(1500);

      const metrics = await service.analyzeCompression(original, larger);

      expect(metrics.savings).toBe(-500);
      expect(metrics.savingsPercentage).toBe(-50);
      expect(metrics.compressionRatio).toBeCloseTo(0.667, 2);
    });
  });

  // ── optimizeImage ────────────────────────────────────────────

  describe("optimizeImage", () => {
    it("should return the same buffer (placeholder implementation)", async () => {
      const buffer = new ArrayBuffer(100);
      const result = await service.optimizeImage(buffer);

      expect(result).toBe(buffer);
    });

    it("should accept custom options", async () => {
      const buffer = new ArrayBuffer(100);
      const result = await service.optimizeImage(buffer, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 75,
        format: "webp",
      });

      expect(result).toBe(buffer);
    });
  });

  // ── deleteImage ──────────────────────────────────────────────

  describe("deleteImage", () => {
    it("should send DELETE request to Cloudflare", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      await service.deleteImage("img-123");

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toContain("/img-123");
      expect(fetchCall[1]?.method).toBe("DELETE");
    });

    it("should throw on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: "Not Found",
        }),
      );

      await expect(service.deleteImage("bad-id")).rejects.toThrow(
        "Failed to delete image: Not Found",
      );
    });
  });

  // ── batchUpload ──────────────────────────────────────────────

  describe("batchUpload", () => {
    it("should upload multiple images", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(async () => {
          callCount++;
          const currentCount = callCount;
          return {
            ok: true,
            json: async () => ({
              result: {
                id: `img-${currentCount}`,
                filename: `file-${currentCount}`,
                uploaded: "",
                requireSignedURLs: false,
                variants: [],
              },
            }),
          };
        }),
      );

      const images = [
        { buffer: new ArrayBuffer(100) },
        { buffer: new ArrayBuffer(200) },
        { buffer: new ArrayBuffer(300) },
      ];

      const results = await service.batchUpload(images, { concurrency: 2 });

      expect(results).toHaveLength(3);
      // Each result should have a unique id and URL with /public suffix
      results.forEach((r) => {
        expect(r.id).toMatch(/^img-\d+$/);
        expect(r.url).toContain("/public");
      });
    });

    it("should call progress callback", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              id: "img-1",
              filename: "f",
              uploaded: "",
              requireSignedURLs: false,
              variants: [],
            },
          }),
        }),
      );

      const onProgress = vi.fn();
      const images = [
        { buffer: new ArrayBuffer(100) },
        { buffer: new ArrayBuffer(200) },
      ];

      await service.batchUpload(images, { concurrency: 1, onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(2, 2); // final call
    });
  });

  // ── getImageMetadata ─────────────────────────────────────────

  describe("getImageMetadata", () => {
    it("should fetch metadata from API", async () => {
      const mockMeta = {
        id: "img-123",
        filename: "test.jpg",
        uploaded: "2025-01-01",
        requireSignedURLs: false,
        variants: ["public"],
        meta: { category: "menu" },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ result: mockMeta }),
        }),
      );

      const result = await service.getImageMetadata("img-123");

      expect(result.id).toBe("img-123");
      expect(result.meta?.category).toBe("menu");
    });

    it("should throw on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          statusText: "Forbidden",
        }),
      );

      await expect(service.getImageMetadata("img-123")).rejects.toThrow(
        "Failed to fetch image metadata",
      );
    });
  });

  // ── generateResponsiveSrcset ─────────────────────────────────

  describe("generateResponsiveSrcset", () => {
    it("should generate srcset with default sizes", () => {
      const srcset = service.generateResponsiveSrcset("img-123");

      expect(srcset).toContain("320w");
      expect(srcset).toContain("640w");
      expect(srcset).toContain("960w");
      expect(srcset).toContain("1280w");
      expect(srcset).toContain("1920w");
    });

    it("should generate srcset with custom sizes", () => {
      const srcset = service.generateResponsiveSrcset("img-123", [100, 200]);

      expect(srcset).toContain("100w");
      expect(srcset).toContain("200w");
      expect(srcset).not.toContain("320w");
    });

    it("should include the image ID in all URLs", () => {
      const srcset = service.generateResponsiveSrcset("my-img");

      srcset.split(", ").forEach((entry) => {
        expect(entry).toContain("my-img");
      });
    });
  });

  // ── validateImage ────────────────────────────────────────────

  describe("validateImage", () => {
    it("should accept valid JPEG buffer within size limit", () => {
      const buffer = createJPEGBuffer();
      const result = service.validateImage(buffer);

      expect(result.valid).toBe(true);
    });

    it("should accept valid PNG buffer", () => {
      const buffer = createPNGBuffer();
      const result = service.validateImage(buffer);

      expect(result.valid).toBe(true);
    });

    it("should accept valid WebP buffer", () => {
      const buffer = createWebPBuffer();
      const result = service.validateImage(buffer);

      expect(result.valid).toBe(true);
    });

    it("should reject buffer exceeding max size", () => {
      const buffer = new ArrayBuffer(20 * 1024 * 1024); // 20MB

      const result = service.validateImage(buffer, {
        maxSize: 10 * 1024 * 1024,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum");
    });

    it("should reject unrecognized format", () => {
      const buffer = new ArrayBuffer(100);
      const arr = new Uint8Array(buffer);
      arr[0] = 0x00;
      arr[1] = 0x00;

      const result = service.validateImage(buffer);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported image format");
    });

    it("should respect custom allowed formats", () => {
      const buffer = createPNGBuffer();

      const result = service.validateImage(buffer, {
        allowedFormats: ["image/jpeg"], // only allow JPEG
      });

      expect(result.valid).toBe(false);
    });
  });
});
