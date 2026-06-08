import { describe, expect, it } from "vitest";
import { getKitchenApiBaseUrl } from "./authApi";

describe("kitchen auth API config", () => {
  it("uses VITE_API_BASE_URL when configured", () => {
    expect(
      getKitchenApiBaseUrl({
        VITE_API_BASE_URL: "https://api.makanmasak.com/api/v1",
        PROD: true,
      } as ImportMetaEnv),
    ).toBe("https://api.makanmasak.com/api/v1");
  });

  it("fails fast when production has no API base URL", () => {
    expect(() => getKitchenApiBaseUrl({ PROD: true } as ImportMetaEnv)).toThrow(
      "VITE_API_BASE_URL is required",
    );
  });

  it("keeps the local proxy fallback outside production", () => {
    expect(getKitchenApiBaseUrl({ PROD: false } as ImportMetaEnv)).toBe(
      "/api/v1",
    );
  });
});
