import { describe, expect, it } from "vitest";
import { resolveVerificationAppBaseUrl } from "./VerificationService";

describe("resolveVerificationAppBaseUrl", () => {
  it("uses the configured client base URL for production links", () => {
    expect(
      resolveVerificationAppBaseUrl({
        NODE_ENV: "production",
        CLIENT_BASE_URL: "https://makanmasak.com/",
        API_BASE_URL: "https://api.makanmasak.com",
      }),
    ).toBe("https://makanmasak.com");
  });

  it("falls back to production CORS_ORIGIN before API_BASE_URL", () => {
    expect(
      resolveVerificationAppBaseUrl({
        NODE_ENV: "production",
        API_BASE_URL: "https://api.makanmasak.com",
        CORS_ORIGIN: "https://makanmasak.com",
      }),
    ).toBe("https://makanmasak.com");
  });

  it("blocks production verification links when no public app URL is set", () => {
    expect(() =>
      resolveVerificationAppBaseUrl({
        NODE_ENV: "production",
        API_BASE_URL: undefined,
        CORS_ORIGIN: undefined,
      }),
    ).toThrow(/CLIENT_BASE_URL or CORS_ORIGIN/);
  });

  it("keeps the local fallback for development", () => {
    expect(resolveVerificationAppBaseUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:5173",
    );
  });
});
