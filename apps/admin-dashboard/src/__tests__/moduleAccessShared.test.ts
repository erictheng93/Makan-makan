import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useModuleAccessStore } from "../../../../packages/shared/stores/moduleAccess";
import { useModuleAccess } from "../../../../packages/shared/composables/useModuleAccess";

describe("shared module access store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.unstubAllGlobals();
  });

  it("loads module access data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            restaurantId: "rest-1",
            planTier: "pro",
            isActive: true,
            trialEndsAt: null,
            deploymentMode: "managed",
            effectiveModules: { pos: true },
          },
        }),
      }),
    );

    const store = useModuleAccessStore();
    await store.fetch();

    expect(store.isLoaded).toBe(true);
    expect(store.isLoading).toBe(false);
    expect(store.planTier).toBe("pro");
    expect(store.effectiveModules.pos).toBe(true);
  });

  it("uses cached loaded data within the TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          restaurantId: "rest-1",
          planTier: "basic",
          isActive: true,
          trialEndsAt: null,
          deploymentMode: "managed",
          effectiveModules: {},
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = useModuleAccessStore();
    await store.fetch();
    await store.fetch();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("resets on authorization errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const store = useModuleAccessStore();
    await store.fetch();

    expect(store.isLoaded).toBe(false);
    expect(store.effectiveModules).toEqual({});
  });

  it("captures network errors without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const store = useModuleAccessStore();
    await expect(store.fetch()).resolves.toEqual(
      expect.objectContaining({ effectiveModules: {} }),
    );

    expect(store.error?.message).toBe("offline");
    expect(store.isLoading).toBe(false);
  });

  it("exposes hasModule and trial expiry through the composable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            restaurantId: "rest-1",
            planTier: "trial",
            isActive: true,
            trialEndsAt: Date.now() - 1000,
            deploymentMode: "managed",
            effectiveModules: { ai_analytics: true },
          },
        }),
      }),
    );

    const store = useModuleAccessStore();
    await store.fetch();
    const access = useModuleAccess();

    expect(access.hasModule("ai_analytics")).toBe(true);
    expect(access.isTrialExpired.value).toBe(true);
    expect(access.isLoaded.value).toBe(true);
  });
});
