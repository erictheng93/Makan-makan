// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("admin API base URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("configures the auth client from VITE_API_BASE_URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.makanmasak.com/api/v1");
    vi.resetModules();

    const { authClient } = await import("./api");

    expect(authClient.instance.defaults.baseURL).toBe(
      "https://api.makanmasak.com/api/v1",
    );
  });
});
