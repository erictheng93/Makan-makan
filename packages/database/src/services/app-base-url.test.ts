import { describe, expect, it } from "vitest";
import { resolveAppBaseUrl } from "./app-base-url";

describe("resolveAppBaseUrl", () => {
  it("prefers CLIENT_BASE_URL and trims trailing slashes", () => {
    expect(
      resolveAppBaseUrl({
        NODE_ENV: "production",
        CLIENT_BASE_URL: "https://makanmasak.com/",
        CORS_ORIGIN: "https://admin.makanmasak.com",
      }),
    ).toBe("https://makanmasak.com");
  });

  it("falls back to the first non-wildcard CORS_ORIGIN entry", () => {
    expect(
      resolveAppBaseUrl({
        NODE_ENV: "production",
        CORS_ORIGIN:
          "https://makanmasak.com,https://admin.makanmasak.com,https://kitchen.makanmasak.com",
      }),
    ).toBe("https://makanmasak.com");
  });

  it("never emits a hardcoded public origin when production config is missing", () => {
    // Regression guard: this used to fall back to a third-party domain, so every
    // table/seat QR code minted in production pointed away from the product.
    expect(() =>
      resolveAppBaseUrl(
        { NODE_ENV: "production", CORS_ORIGIN: undefined },
        "table QR codes",
      ),
    ).toThrow(/CLIENT_BASE_URL or CORS_ORIGIN .* table QR codes/);
  });

  it("ignores a wildcard CORS_ORIGIN rather than signing links for '*'", () => {
    expect(() =>
      resolveAppBaseUrl({ NODE_ENV: "production", CORS_ORIGIN: "*" }),
    ).toThrow(/CLIENT_BASE_URL or CORS_ORIGIN/);
  });

  it("keeps the local fallback for development", () => {
    expect(resolveAppBaseUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:5173",
    );
  });

  it("derives the app origin from API_BASE_URL outside production", () => {
    expect(
      resolveAppBaseUrl({
        NODE_ENV: "development",
        API_BASE_URL: "https://staging.example.com/api/v1",
      }),
    ).toBe("https://staging.example.com");
  });
});
