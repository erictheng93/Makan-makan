/**
 * Tests for Cloudflare Images utility
 */
import { describe, it, expect } from "vitest";
import { isCloudflareImagesHostname } from "../utils/cloudflareImages";

describe("isCloudflareImagesHostname", () => {
  it("returns true for imagedelivery.net", () => {
    expect(isCloudflareImagesHostname("imagedelivery.net")).toBe(true);
  });

  it("returns true for subdomains of imagedelivery.net", () => {
    expect(isCloudflareImagesHostname("abc.imagedelivery.net")).toBe(true);
    expect(isCloudflareImagesHostname("my-account.imagedelivery.net")).toBe(
      true,
    );
  });

  it("returns true for images.cloudflare.com", () => {
    expect(isCloudflareImagesHostname("images.cloudflare.com")).toBe(true);
  });

  it("returns true for subdomains of images.cloudflare.com", () => {
    expect(isCloudflareImagesHostname("abc.images.cloudflare.com")).toBe(true);
  });

  it("returns false for unrelated hostnames", () => {
    expect(isCloudflareImagesHostname("example.com")).toBe(false);
    expect(isCloudflareImagesHostname("google.com")).toBe(false);
    expect(isCloudflareImagesHostname("cloudflare.com")).toBe(false);
    expect(isCloudflareImagesHostname("api.cloudflare.com")).toBe(false);
  });

  it("returns false for hostnames that merely contain the keywords", () => {
    expect(isCloudflareImagesHostname("fakeimagedelivery.net")).toBe(false);
    expect(
      isCloudflareImagesHostname("not-images.cloudflare.com.evil.com"),
    ).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCloudflareImagesHostname("")).toBe(false);
  });
});
