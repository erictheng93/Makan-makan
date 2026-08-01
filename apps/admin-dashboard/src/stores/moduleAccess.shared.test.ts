import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureModuleAccess,
  useModuleAccessStore,
} from "@makanmakan/shared/stores/moduleAccess";

const API_BASE = "https://api.makanmasak.com/api/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** What a static host's SPA fallback returns for an unmatched path. */
function spaFallbackResponse(): Response {
  return new Response("<!doctype html><title>admin</title>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function buildAccess(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: "rest-1",
    planTier: "pro",
    isActive: true,
    trialEndsAt: null,
    effectiveModules: { inventory: true },
    ...overrides,
  };
}

describe("moduleAccess store", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    configureModuleAccess({ baseUrl: API_BASE, getToken: () => "token-abc" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Leave the module-level transport at its default so ordering between
    // files cannot leak configuration.
    configureModuleAccess({ baseUrl: "/api/v1", getToken: () => null });
  });

  it("requests the configured API origin, not the app's own origin", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    await useModuleAccessStore().fetch();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/me/modules`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends the bearer token from the configured provider", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    await useModuleAccessStore().fetch();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc",
          Accept: "application/json",
        }),
      }),
    );
  });

  it("omits Authorization when the host has no bearer token", async () => {
    configureModuleAccess({ getToken: () => null });
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    await useModuleAccessStore().fetch();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("joins the path correctly when the base has a trailing slash", async () => {
    configureModuleAccess({ baseUrl: `${API_BASE}/` });
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    await useModuleAccessStore().fetch();

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/me/modules`,
      expect.anything(),
    );
  });

  it("stores the returned module access", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    const store = useModuleAccessStore();
    await store.fetch();

    expect(store.effectiveModules).toEqual({ inventory: true });
    expect(store.planTier).toBe("pro");
    expect(store.isLoaded).toBe(true);
    expect(store.error).toBeNull();
  });

  it("surfaces an error when a 200 response is not JSON", async () => {
    // The regression this guards: a same-origin base URL reaches the SPA
    // fallback, which is a 200 -- so without the content-type check the store
    // silently ended up with zero modules and every gated feature hidden.
    fetchMock.mockResolvedValue(spaFallbackResponse());

    const store = useModuleAccessStore();
    await store.fetch();

    expect(store.error).toBeInstanceOf(Error);
    expect(store.error?.message).toContain("Expected JSON");
    expect(store.isLoaded).toBe(false);
  });

  it("resets without recording an error on 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 401));

    const store = useModuleAccessStore();
    await store.fetch();

    expect(store.effectiveModules).toEqual({});
    expect(store.isLoaded).toBe(false);
    expect(store.error).toBeNull();
  });

  it("serves from cache until forced", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: buildAccess() }),
    );

    const store = useModuleAccessStore();
    await store.fetch();
    await store.fetch();
    expect(fetchMock).toHaveBeenCalledOnce();

    await store.fetch({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
