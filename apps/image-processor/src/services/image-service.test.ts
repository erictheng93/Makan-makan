import { describe, expect, it, vi } from "vitest";
import { ImageService } from "./image-service";
import type { Env } from "../types/env";

vi.mock("@makanmasak/database", () => ({
  ImageService: vi.fn().mockImplementation(function ImageService() {
    return {};
  }),
}));

function buildEnv(imageBaseUrl: string): Env {
  return {
    DB: {},
    IMAGE_CACHE: {},
    IMAGES_BUCKET: {},
    IMAGE_API_BASE_URL: imageBaseUrl,
  } as unknown as Env;
}

describe("ImageService", () => {
  it("builds image URLs after stripping trailing base URL slashes", () => {
    const service = new ImageService(buildEnv("https://images.test///"));

    expect(service.generateImageUrl("image/1", "medium/large")).toBe(
      "https://images.test/images/image%2F1/medium%2Flarge",
    );
  });

  it("preserves a base URL that has no trailing slash", () => {
    const service = new ImageService(buildEnv("https://images.test"));

    expect(service.generateImageUrl("image-1", "medium")).toBe(
      "https://images.test/images/image-1/medium",
    );
  });

  it("handles long runs of trailing slashes without regular expression backtracking", () => {
    const service = new ImageService(
      buildEnv(`https://images.test${"/".repeat(50_000)}`),
    );

    expect(service.generateImageUrl("image-1", "medium")).toBe(
      "https://images.test/images/image-1/medium",
    );
  });
});
