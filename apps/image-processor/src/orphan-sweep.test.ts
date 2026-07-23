import { beforeEach, describe, expect, it, vi } from "vitest";
import { sweepOrphanedImages } from "./index";
import type { Env } from "./types/env";

const HOUR = 60 * 60 * 1000;

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function buildEnv(): Env {
  return {} as Env;
}

describe("sweepOrphanedImages", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("deletes only images older than 48h that are unreferenced", async () => {
    const listImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          { id: "old-orphan", uploaded: isoAgo(72 * HOUR) },
          { id: "old-referenced", uploaded: isoAgo(72 * HOUR) },
          { id: "fresh-orphan", uploaded: isoAgo(2 * HOUR) },
        ],
      },
    });
    const deleteImage = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      cloudflareImages: { listImages, deleteImage },
      resolveReferenced: async () => new Set(["old-referenced"]),
    });

    // Only the >48h AND unreferenced image is deleted.
    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith("old-orphan");
    // Referenced image survives.
    expect(deleteImage).not.toHaveBeenCalledWith("old-referenced");
    // Fresh image (<48h) survives even though unreferenced.
    expect(deleteImage).not.toHaveBeenCalledWith("fresh-orphan");
  });

  it("only passes >48h candidates to the reference resolver", async () => {
    const listImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          { id: "old-1", uploaded: isoAgo(50 * HOUR) },
          { id: "fresh-1", uploaded: isoAgo(HOUR) },
        ],
      },
    });
    const deleteImage = vi.fn().mockResolvedValue({ success: true });
    const resolveReferenced = vi.fn().mockResolvedValue(new Set<string>());

    await sweepOrphanedImages(buildEnv(), {
      cloudflareImages: { listImages, deleteImage },
      resolveReferenced,
    });

    expect(resolveReferenced).toHaveBeenCalledOnce();
    expect(resolveReferenced).toHaveBeenCalledWith(["old-1"]);
  });

  it("caps deletions at 100 per run to bound cron time", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `orphan-${i}`,
      uploaded: isoAgo(72 * HOUR),
    }));
    // A single page of 100, then a second page with the remainder.
    const listImages = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { images: many.slice(0, 100) },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { images: many.slice(100) },
      });
    const deleteImage = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      cloudflareImages: { listImages, deleteImage },
      resolveReferenced: async () => new Set<string>(),
    });

    expect(deleteImage).toHaveBeenCalledTimes(100);
  });

  it("does not delete when reference lookup throws (fails safe)", async () => {
    const listImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [{ id: "old-1", uploaded: isoAgo(72 * HOUR) }],
      },
    });
    const deleteImage = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      cloudflareImages: { listImages, deleteImage },
      resolveReferenced: async () => {
        throw new Error("db down");
      },
    });

    expect(deleteImage).not.toHaveBeenCalled();
  });

  it("stops and does not throw when listImages fails", async () => {
    const listImages = vi
      .fn()
      .mockResolvedValue({ success: false, error: "cf down" });
    const deleteImage = vi.fn();

    await expect(
      sweepOrphanedImages(buildEnv(), {
        cloudflareImages: { listImages, deleteImage },
        resolveReferenced: async () => new Set<string>(),
      }),
    ).resolves.toBeUndefined();

    expect(deleteImage).not.toHaveBeenCalled();
  });

  it("logs every deletion with the image id", async () => {
    const logSpy = vi.spyOn(console, "log");
    const listImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [{ id: "orphan-xyz", uploaded: isoAgo(72 * HOUR) }],
      },
    });
    const deleteImage = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      cloudflareImages: { listImages, deleteImage },
      resolveReferenced: async () => new Set<string>(),
    });

    expect(
      logSpy.mock.calls.some((args) =>
        args.some(
          (arg) => typeof arg === "string" && arg.includes("orphan-xyz"),
        ),
      ),
    ).toBe(true);
  });
});
