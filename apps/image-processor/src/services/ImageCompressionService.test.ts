import { describe, expect, it, vi } from "vitest";
import { ImageCompressionService } from "./ImageCompressionService";

const service = () =>
  new ImageCompressionService({
    accountId: "account-123",
    apiToken: "token-123",
    deliveryUrl: "https://images.example.test",
  });

const bufferFromBytes = (bytes: number[]) => new Uint8Array(bytes).buffer;

describe("ImageCompressionService", () => {
  it("accepts supported images by magic number", () => {
    const compression = service();

    expect(
      compression.validateImage(bufferFromBytes([0xff, 0xd8, 0xff, 0xe0])),
    ).toEqual({ valid: true });
    expect(
      compression.validateImage(bufferFromBytes([0x89, 0x50, 0x4e, 0x47])),
    ).toEqual({ valid: true });
    expect(
      compression.validateImage(bufferFromBytes([0x52, 0x49, 0x46, 0x46])),
    ).toEqual({ valid: true });
  });

  it("rejects oversized and unsupported image uploads", () => {
    const compression = service();

    expect(
      compression.validateImage(bufferFromBytes([0xff, 0xd8, 0xff, 0xe0]), {
        maxSize: 2,
      }),
    ).toMatchObject({
      valid: false,
      error: "Image size (0.00MB) exceeds maximum allowed size (0.00MB)",
    });
    expect(
      compression.validateImage(bufferFromBytes([0x25, 0x50, 0x44, 0x46])),
    ).toMatchObject({
      valid: false,
      error:
        "Unsupported image format. Allowed formats: image/jpeg, image/png, image/webp",
    });
  });

  it("generates deterministic menu item variants and responsive srcset URLs", async () => {
    const compression = service();

    await expect(
      compression.generateMenuItemVariants("image-abc"),
    ).resolves.toMatchObject({
      thumbnail:
        "https://images.example.test/image-abc/w=150,h=150,q=80,f=auto,fit=cover",
      "medium-webp":
        "https://images.example.test/image-abc/w=640,h=640,q=85,f=webp,fit=scale-down",
    });

    expect(compression.generateResponsiveSrcset("image-abc", [320, 640])).toBe(
      [
        "https://images.example.test/image-abc/w=320,q=85,f=auto,fit=scale-down 320w",
        "https://images.example.test/image-abc/w=640,q=85,f=auto,fit=scale-down 640w",
      ].join(", "),
    );
  });

  it("reports compression savings from buffer sizes", async () => {
    const compression = service();

    await expect(
      compression.analyzeCompression(new ArrayBuffer(100), new ArrayBuffer(40)),
    ).resolves.toEqual({
      originalSize: 100,
      compressedSize: 40,
      compressionRatio: 2.5,
      savings: 60,
      savingsPercentage: 60,
    });
  });

  it("uploads batches sequentially and reports progress after each batch", async () => {
    const compression = service();
    const upload = vi
      .spyOn(compression, "uploadAndCompress")
      .mockImplementation(async (_buffer, metadata = {}) => ({
        id: metadata.metadata?.id ?? "unknown",
        filename: "image.jpg",
        uploaded: "2026-06-07T00:00:00.000Z",
        requireSignedURLs: false,
        variants: [],
      }));
    const onProgress = vi.fn();

    await expect(
      compression.batchUpload(
        [
          { buffer: new ArrayBuffer(1), metadata: { id: "one" } },
          { buffer: new ArrayBuffer(1), metadata: { id: "two" } },
          { buffer: new ArrayBuffer(1), metadata: { id: "three" } },
        ],
        { concurrency: 2, onProgress },
      ),
    ).resolves.toEqual([
      { id: "one", url: "https://images.example.test/one/public" },
      { id: "two", url: "https://images.example.test/two/public" },
      { id: "three", url: "https://images.example.test/three/public" },
    ]);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });
});
