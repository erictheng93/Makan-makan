/**
 * Tests for CloudflareImagesAPI and ImageUtils
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareImagesAPI, ImageUtils } from "../utils/cloudflare-images";
import { createMockEnv } from "./setup";
import type { Env } from "../types/env";

// ── CloudflareImagesAPI ────────────────────────────────────────────

describe("CloudflareImagesAPI", () => {
  let env: ReturnType<typeof createMockEnv>;
  let api: CloudflareImagesAPI;

  beforeEach(() => {
    env = createMockEnv();
    api = new CloudflareImagesAPI(env as unknown as Env);
    vi.restoreAllMocks();
    // Re-suppress console noise after restoreAllMocks
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // ── uploadImage ──────────────────────────────────────────────

  describe("uploadImage", () => {
    it("should upload a File successfully", async () => {
      const mockResponse = {
        success: true,
        errors: [],
        messages: [],
        result: {
          id: "img-123",
          filename: "test.jpg",
          uploaded: new Date().toISOString(),
          requireSignedURLs: false,
          variants: ["public"],
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      );

      const file = new File(["image-data"], "test.jpg", {
        type: "image/jpeg",
      });
      const result = await api.uploadImage(file, {
        filename: "unique-test.jpg",
        metadata: { originalName: "test.jpg" },
      });

      expect(result.success).toBe(true);
      expect(result.result.id).toBe("img-123");
      expect(fetch).toHaveBeenCalledOnce();

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toBe(
        `https://api.cloudflare.com/client/v4/accounts/test-account-id/images/v1`,
      );
      expect(fetchCall[1]?.method).toBe("POST");
    });

    it("should upload an ArrayBuffer successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            errors: [],
            result: { id: "img-456" },
          }),
        }),
      );

      const buffer = new ArrayBuffer(100);
      const result = await api.uploadImage(buffer, {
        filename: "from-buffer.jpg",
      });

      expect(result.success).toBe(true);
      expect(result.result.id).toBe("img-456");
    });

    it("should handle API errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            errors: [{ code: 5400, message: "Bad request" }],
          }),
        }),
      );

      const file = new File(["data"], "bad.jpg", { type: "image/jpeg" });
      const result = await api.uploadImage(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Bad request");
    });

    it("should handle network errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network failure")),
      );

      const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
      const result = await api.uploadImage(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });
  });

  // ── getImageDetails ──────────────────────────────────────────

  describe("getImageDetails", () => {
    it("should return image details on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            errors: [],
            result: {
              id: "img-123",
              filename: "test.jpg",
              variants: ["public", "thumbnail"],
            },
          }),
        }),
      );

      const result = await api.getImageDetails("img-123");

      expect(result.success).toBe(true);
      expect(result.result.id).toBe("img-123");
    });

    it("should handle not-found errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            errors: [{ code: 5404, message: "Image not found" }],
          }),
        }),
      );

      const result = await api.getImageDetails("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Image not found");
    });

    it("should handle fetch exceptions", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));

      const result = await api.getImageDetails("img-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Timeout");
    });
  });

  // ── listImages ───────────────────────────────────────────────

  describe("listImages", () => {
    it("should list images with pagination", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            errors: [],
            result: { images: [{ id: "img-1" }, { id: "img-2" }] },
          }),
        }),
      );

      const result = await api.listImages({ page: 1, perPage: 20 });

      expect(result.success).toBe(true);
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain("page=1");
      expect(url).toContain("per_page=20");
    });

    it("should list images without params", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            errors: [],
            result: { images: [] },
          }),
        }),
      );

      const result = await api.listImages();

      expect(result.success).toBe(true);
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).not.toContain("?");
    });
  });

  // ── deleteImage ──────────────────────────────────────────────

  describe("deleteImage", () => {
    it("should delete image successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({ success: true, errors: [] }),
        }),
      );

      const result = await api.deleteImage("img-123");

      expect(result.success).toBe(true);
      expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("DELETE");
    });

    it("should handle delete errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: false,
            errors: [{ message: "Cannot delete" }],
          }),
        }),
      );

      const result = await api.deleteImage("img-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot delete");
    });
  });

  // ── updateImageMetadata ──────────────────────────────────────

  describe("updateImageMetadata", () => {
    it("should update metadata via PATCH", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            errors: [],
            result: { id: "img-123" },
          }),
        }),
      );

      const result = await api.updateImageMetadata("img-123", {
        category: "menu",
      });

      expect(result.success).toBe(true);
      expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("PATCH");
    });
  });

  // ── generateImageVariants ────────────────────────────────────

  describe("generateImageVariants", () => {
    it("should generate all standard variant URLs", () => {
      const variants = api.generateImageVariants("img-123", "acct-hash");

      expect(variants.original).toBe(
        "https://imagedelivery.net/acct-hash/img-123/original",
      );
      expect(variants.thumbnail).toBe(
        "https://imagedelivery.net/acct-hash/img-123/thumbnail",
      );
      expect(variants.small).toBe(
        "https://imagedelivery.net/acct-hash/img-123/small",
      );
      expect(variants.medium).toBe(
        "https://imagedelivery.net/acct-hash/img-123/medium",
      );
      expect(variants.large).toBe(
        "https://imagedelivery.net/acct-hash/img-123/large",
      );
      expect(variants.square_thumbnail).toContain("w=150,h=150");
      expect(variants.webp_medium).toContain("format=webp");
      expect(variants.mobile_optimized).toContain("w=400");
      expect(variants.retina).toContain("dpr=2");
    });
  });

  // ── buildTransformationURL ───────────────────────────────────

  describe("buildTransformationURL", () => {
    it("should build resize transformation URL", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "resize", width: 800, height: 600, fit: "cover" },
      ]);

      expect(url).toBe(
        "https://imagedelivery.net/acct-hash/img-123/w=800,h=600,fit=cover",
      );
    });

    it("should build crop transformation URL with gravity", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "crop", width: 200, height: 200, gravity: "auto" },
      ]);

      expect(url).toContain("fit=crop");
      expect(url).toContain("gravity=auto");
      expect(url).toContain("w=200");
    });

    it("should build rotate transformation URL", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "rotate", angle: 90 },
      ]);

      expect(url).toContain("rotate=90");
    });

    it("should build blur transformation URL", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "blur", radius: 10 },
      ]);

      expect(url).toContain("blur=10");
    });

    it("should build brighten transformation URL", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "brighten", amount: 50 },
      ]);

      expect(url).toContain("brightness=50");
    });

    it("should build sharpen transformation URL", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "sharpen", amount: 5 },
      ]);

      expect(url).toContain("sharpen=5");
    });

    it("should combine multiple transformations", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", [
        { type: "resize", width: 400 },
        { type: "blur", radius: 3 },
      ]);

      expect(url).toContain("w=400");
      expect(url).toContain("blur=3");
    });

    it("should return original URL when no transformations", () => {
      const url = api.buildTransformationURL("img-123", "acct-hash", []);

      expect(url).toBe("https://imagedelivery.net/acct-hash/img-123/original");
    });
  });

  // ── validateImageFile ────────────────────────────────────────

  describe("validateImageFile", () => {
    it("should accept valid JPEG file", () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

      const result = api.validateImageFile(
        file,
        ["image/jpeg", "image/png"],
        10,
      );

      expect(result.valid).toBe(true);
    });

    it("should reject unsupported MIME type", () => {
      const file = new File(["data"], "doc.pdf", { type: "application/pdf" });

      const result = api.validateImageFile(
        file,
        ["image/jpeg", "image/png"],
        10,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("should reject file exceeding max size", () => {
      const file = new File(["data"], "huge.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 }); // 20MB

      const result = api.validateImageFile(file, ["image/jpeg"], 10);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should be case-insensitive for MIME types", () => {
      const file = new File(["data"], "photo.jpg", { type: "IMAGE/JPEG" });
      Object.defineProperty(file, "size", { value: 1024 });

      const result = api.validateImageFile(file, ["image/jpeg"], 10);

      expect(result.valid).toBe(true);
    });
  });

  // ── extractImageMetadata ─────────────────────────────────────

  describe("extractImageMetadata", () => {
    it("should return basic file metadata", async () => {
      const file = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      const metadata = await api.extractImageMetadata(file);

      expect(metadata.size).toBe(file.size);
      expect(metadata.format).toBe("image/jpeg");
    });
  });

  // ── generateSignedURL ────────────────────────────────────────

  describe("generateSignedURL", () => {
    it("should generate direct URL (placeholder implementation)", () => {
      const url = api.generateSignedURL("img-123", "acct-hash", 3600);

      expect(url).toBe("https://imagedelivery.net/acct-hash/img-123/original");
    });
  });
});

// ── ImageUtils ─────────────────────────────────────────────────────

describe("ImageUtils", () => {
  describe("generateUniqueFilename", () => {
    it("should preserve file extension", () => {
      const filename = ImageUtils.generateUniqueFilename("photo.jpg");
      expect(filename).toMatch(/\.jpg$/);
    });

    it("should replace special characters with hyphens", () => {
      const filename = ImageUtils.generateUniqueFilename("my photo (1).png");
      expect(filename).not.toContain(" ");
      expect(filename).not.toContain("(");
      expect(filename).toMatch(/\.png$/);
    });

    it("should include timestamp for uniqueness", () => {
      const fn1 = ImageUtils.generateUniqueFilename("test.jpg");
      const fn2 = ImageUtils.generateUniqueFilename("test.jpg");
      // Very unlikely to be identical due to random suffix
      // but the format should be consistent
      expect(fn1).toMatch(/^test-\d+-[a-z0-9]+\.jpg$/);
      expect(fn2).toMatch(/^test-\d+-[a-z0-9]+\.jpg$/);
    });
  });

  describe("parseVariantsConfig", () => {
    it("should parse known variant names to correct dimensions", () => {
      const variants = ImageUtils.parseVariantsConfig(
        "thumbnail,small,medium,large",
      );

      expect(variants.thumbnail).toEqual({ width: 150, height: 150 });
      expect(variants.small).toEqual({ width: 300, height: 300 });
      expect(variants.medium).toEqual({ width: 600, height: 600 });
      expect(variants.large).toEqual({ width: 1200, height: 1200 });
    });

    it("should use default dimensions for unknown variants", () => {
      const variants = ImageUtils.parseVariantsConfig("custom");

      expect(variants.custom).toEqual({ width: 600, height: 600 });
    });

    it("should handle single variant", () => {
      const variants = ImageUtils.parseVariantsConfig("thumbnail");

      expect(Object.keys(variants)).toHaveLength(1);
      expect(variants.thumbnail).toEqual({ width: 150, height: 150 });
    });

    it("should trim whitespace from variant names", () => {
      const variants = ImageUtils.parseVariantsConfig(" thumbnail , small ");

      expect(variants.thumbnail).toBeDefined();
      expect(variants.small).toBeDefined();
    });
  });

  describe("calculateOptimalQuality", () => {
    it("should return lower quality for large webp images", () => {
      const quality = ImageUtils.calculateOptimalQuality("webp", 2000, 1500);
      expect(quality).toBe(80);
    });

    it("should return medium quality for medium webp images", () => {
      const quality = ImageUtils.calculateOptimalQuality("webp", 800, 600);
      expect(quality).toBe(85);
    });

    it("should return higher quality for small webp images", () => {
      const quality = ImageUtils.calculateOptimalQuality("webp", 200, 200);
      expect(quality).toBe(90);
    });

    it("should return lower quality for large jpeg images", () => {
      const quality = ImageUtils.calculateOptimalQuality("jpeg", 2000, 1500);
      expect(quality).toBe(75);
    });

    it("should return medium quality for medium jpeg images", () => {
      const quality = ImageUtils.calculateOptimalQuality("jpeg", 800, 600);
      expect(quality).toBe(80);
    });

    it("should return higher quality for small jpeg images", () => {
      const quality = ImageUtils.calculateOptimalQuality("jpeg", 200, 200);
      expect(quality).toBe(85);
    });

    it("should return default quality for unknown formats", () => {
      const quality = ImageUtils.calculateOptimalQuality("avif", 1000, 1000);
      expect(quality).toBe(85);
    });
  });

  describe("getBestFormat", () => {
    it("should prefer webp when supported", () => {
      const format = ImageUtils.getBestFormat(
        "image/webp,image/png,*/*",
        "Chrome/100",
      );
      expect(format).toBe("webp");
    });

    it("should prefer avif when supported but not webp", () => {
      const format = ImageUtils.getBestFormat(
        "image/avif,image/png",
        "Safari/16",
      );
      expect(format).toBe("avif");
    });

    it("should fallback to jpeg when no modern formats supported", () => {
      const format = ImageUtils.getBestFormat("image/png,*/*", "IE/11");
      expect(format).toBe("jpeg");
    });

    it("should fallback to jpeg with empty accept header", () => {
      const format = ImageUtils.getBestFormat("", "");
      expect(format).toBe("jpeg");
    });

    it("should prefer webp over avif when both supported", () => {
      // This tests the current implementation order
      const format = ImageUtils.getBestFormat("image/avif,image/webp", "");
      expect(format).toBe("webp");
    });
  });
});
