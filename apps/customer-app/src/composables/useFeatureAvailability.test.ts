// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetFeatureAvailability,
  loadFeatureAvailability,
  useFeatureAvailability,
} from "./useFeatureAvailability";

function respond(body: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("useFeatureAvailability", () => {
  beforeEach(() => {
    __resetFeatureAvailability();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the features /info reports as disabled", async () => {
    vi.stubGlobal(
      "fetch",
      respond({
        disabledFeatures: [
          { feature: "tenantBackups", flag: "X", prefix: "/backup" },
          { feature: "webPush", flag: "Y", prefix: "/push" },
        ],
      }),
    );

    await loadFeatureAvailability();
    const { isDisabled } = useFeatureAvailability();

    expect(isDisabled("tenantBackups")).toBe(true);
    expect(isDisabled("webPush")).toBe(true);
    expect(isDisabled("marketCheckouts")).toBe(false);
  });

  it("requests /info outside the versioned API base", async () => {
    const fetchMock = respond({ disabledFeatures: [] });
    vi.stubGlobal("fetch", fetchMock);

    await loadFeatureAvailability();

    // /info is mounted at the app root, so a request to /api/v1/info would 404
    // and every feature would silently look available.
    expect(fetchMock).toHaveBeenCalledWith(
      "/info",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("shares one request between concurrent callers", async () => {
    const fetchMock = respond({ disabledFeatures: [] });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      loadFeatureAvailability(),
      loadFeatureAvailability(),
      loadFeatureAvailability(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Presentation only -- the API's 404 gate is what actually enforces this. A
  // wrong "unavailable" hides something that works; a wrong "available" leads
  // to an error the user can retry.
  it("fails open when /info cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    );

    await loadFeatureAvailability();
    const { isDisabled } = useFeatureAvailability();

    expect(isDisabled("marketCheckouts")).toBe(false);
    expect(isDisabled("webPush")).toBe(false);
  });

  it("fails open on a non-ok response", async () => {
    vi.stubGlobal("fetch", respond({}, false));

    await loadFeatureAvailability();

    expect(useFeatureAvailability().isDisabled("webPush")).toBe(false);
  });

  it("treats a missing disabledFeatures field as nothing disabled", async () => {
    vi.stubGlobal("fetch", respond({ name: "MakanMasak API" }));

    await loadFeatureAvailability();

    expect(useFeatureAvailability().disabledFeatures.value.size).toBe(0);
  });

  // Production points this at an absolute origin, which is the shape the URL
  // derivation can most plausibly get wrong -- a stray /api/v1 would 404 and
  // leave every feature looking available.
  it("derives /info from an absolute API base", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.makanmasak.com/api/v1");
    const fetchMock = respond({ disabledFeatures: [] });
    vi.stubGlobal("fetch", fetchMock);

    await loadFeatureAvailability();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.makanmasak.com/info",
      expect.anything(),
    );
    vi.unstubAllEnvs();
  });

  it("tolerates a trailing slash on the API base", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.makanmasak.com/api/v1/");
    const fetchMock = respond({ disabledFeatures: [] });
    vi.stubGlobal("fetch", fetchMock);

    await loadFeatureAvailability();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.makanmasak.com/info",
      expect.anything(),
    );
    vi.unstubAllEnvs();
  });
});
