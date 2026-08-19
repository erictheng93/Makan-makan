// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

describe("admin API base URL", () => {
  // The first import of ./api transforms the whole auth-client/axios graph,
  // which alone can eat the 5s test timeout on a loaded machine (#211). Pay
  // that cost here, under the hook's own budget, so the timed test bodies
  // only measure the re-import of already-transformed modules.
  beforeAll(async () => {
    await import("./api");
    vi.resetModules();
  }, 30_000);

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

  it("configures the management auth client from VITE_MANAGEMENT_API_URL", async () => {
    vi.stubEnv(
      "VITE_MANAGEMENT_API_URL",
      "https://manage-api.makanmasak.com/api/v1",
    );
    vi.resetModules();

    const { managementAuthClient } = await import("./api");

    expect(managementAuthClient.instance.defaults.baseURL).toBe(
      "https://manage-api.makanmasak.com/api/v1",
    );
  });
});
