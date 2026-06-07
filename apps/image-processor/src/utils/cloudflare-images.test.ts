import { describe, expect, it, vi } from "vitest";
import { CloudflareImagesAPI, ImageUtils } from "./cloudflare-images";
import type { Env } from "../types/env";

const env = {
  IMAGE_API_BASE_URL: "https://api.cloudflare.com/client/v4/accounts",
  CLOUDFLARE_ACCOUNT_ID: "account-123",
  CLOUDFLARE_IMAGES_API_TOKEN: "token-123",
} as Env;

describe("CloudflareImagesAPI", () => {
  it("builds transformation URLs from resize, crop, and filter operations", () => {
    const api = new CloudflareImagesAPI(env);

    expect(
      api.buildTransformationURL("image-abc", "hash-123", [
        { type: "resize", width: 600, height: 400, fit: "cover" },
        { type: "crop", width: 300, height: 200, gravity: "auto" },
        { type: "brighten", amount: 10 },
      ]),
    ).toBe(
      "https://imagedelivery.net/hash-123/image-abc/w=600,h=400,fit=cover,w=300,h=200,fit=crop,gravity=auto,brightness=10",
    );
  });

  it("returns Cloudflare API errors without throwing for failed JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        errors: [{ message: "image not found" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = new CloudflareImagesAPI(env);

    await expect(api.getImageDetails("missing-image")).resolves.toEqual({
      success: false,
      error: "image not found",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account-123/images/v1/missing-image",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });
});

describe("ImageUtils", () => {
  it("normalizes filenames while preserving extension", () => {
    vi.spyOn(Date, "now").mockReturnValue(1770000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(ImageUtils.generateUniqueFilename("Menu Item (Large).jpg")).toBe(
      "Menu-Item--Large--1770000000000-4fzzzx.jpg",
    );
  });

  it("parses known and custom variant names", () => {
    expect(ImageUtils.parseVariantsConfig("thumbnail,medium,banner")).toEqual({
      thumbnail: { width: 150, height: 150 },
      medium: { width: 600, height: 600 },
      banner: { width: 600, height: 600 },
    });
  });

  it("selects quality and delivery format from image characteristics", () => {
    expect(ImageUtils.calculateOptimalQuality("webp", 1200, 900)).toBe(80);
    expect(ImageUtils.calculateOptimalQuality("jpeg", 500, 900)).toBe(80);
    expect(ImageUtils.getBestFormat("image/png,image/webp")).toBe("webp");
    expect(ImageUtils.getBestFormat("image/png")).toBe("jpeg");
  });
});
