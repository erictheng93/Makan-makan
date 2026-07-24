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
    const listStoredImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          {
            id: "old-orphan",
            key: "old-orphan/original",
            variant: "original",
            uploaded: isoAgo(72 * HOUR),
          },
          {
            id: "old-referenced",
            key: "old-referenced/original",
            variant: "original",
            uploaded: isoAgo(72 * HOUR),
          },
          {
            id: "fresh-orphan",
            key: "fresh-orphan/original",
            variant: "original",
            uploaded: isoAgo(2 * HOUR),
          },
        ],
      },
    });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      imageStorage: { listStoredImages, deleteImageVariants },
      resolveReferenced: async () => new Set(["old-referenced"]),
    });

    // Only the >48h AND unreferenced image is deleted.
    expect(deleteImageVariants).toHaveBeenCalledTimes(1);
    expect(deleteImageVariants).toHaveBeenCalledWith("old-orphan", [
      "original",
    ]);
    // Referenced image survives.
    expect(deleteImageVariants).not.toHaveBeenCalledWith(
      "old-referenced",
      expect.anything(),
    );
    // Fresh image (<48h) survives even though unreferenced.
    expect(deleteImageVariants).not.toHaveBeenCalledWith(
      "fresh-orphan",
      expect.anything(),
    );
  });

  it("only passes >48h candidates to the reference resolver", async () => {
    const listStoredImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          {
            id: "old-1",
            key: "old-1/original",
            variant: "original",
            uploaded: isoAgo(50 * HOUR),
          },
          {
            id: "fresh-1",
            key: "fresh-1/original",
            variant: "original",
            uploaded: isoAgo(HOUR),
          },
        ],
      },
    });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });
    const resolveReferenced = vi.fn().mockResolvedValue(new Set<string>());

    await sweepOrphanedImages(buildEnv(), {
      imageStorage: { listStoredImages, deleteImageVariants },
      resolveReferenced,
    });

    expect(resolveReferenced).toHaveBeenCalledOnce();
    expect(resolveReferenced).toHaveBeenCalledWith(["old-1"]);
  });

  it("caps deletions at 100 per run to bound cron time", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `orphan-${i}`,
      key: `orphan-${i}/original`,
      variant: "original",
      uploaded: isoAgo(72 * HOUR),
    }));
    // A single page of 100, then a second page with the remainder.
    const listStoredImages = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { images: many.slice(0, 100), cursor: "next" },
      })
      .mockResolvedValueOnce({
        success: true,
        result: { images: many.slice(100) },
      });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      imageStorage: { listStoredImages, deleteImageVariants },
      resolveReferenced: async () => new Set<string>(),
    });

    expect(deleteImageVariants).toHaveBeenCalledTimes(100);
  });

  it("does not delete when reference lookup throws (fails safe)", async () => {
    const listStoredImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          {
            id: "old-1",
            key: "old-1/original",
            variant: "original",
            uploaded: isoAgo(72 * HOUR),
          },
        ],
      },
    });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      imageStorage: { listStoredImages, deleteImageVariants },
      resolveReferenced: async () => {
        throw new Error("db down");
      },
    });

    expect(deleteImageVariants).not.toHaveBeenCalled();
  });

  it("stops and does not throw when R2 list fails", async () => {
    const listStoredImages = vi
      .fn()
      .mockResolvedValue({ success: false, error: "cf down" });
    const deleteImageVariants = vi.fn();

    await expect(
      sweepOrphanedImages(buildEnv(), {
        imageStorage: { listStoredImages, deleteImageVariants },
        resolveReferenced: async () => new Set<string>(),
      }),
    ).resolves.toBeUndefined();

    expect(deleteImageVariants).not.toHaveBeenCalled();
  });

  it("logs every deletion with the image id", async () => {
    const logSpy = vi.spyOn(console, "log");
    const listStoredImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          {
            id: "orphan-xyz",
            key: "orphan-xyz/original",
            variant: "original",
            uploaded: isoAgo(72 * HOUR),
          },
        ],
      },
    });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages(buildEnv(), {
      imageStorage: { listStoredImages, deleteImageVariants },
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
