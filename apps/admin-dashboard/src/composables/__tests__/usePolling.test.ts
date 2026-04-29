import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { useAuthStore } from "@/stores/auth";

const mockApiGet = vi.fn();

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  authClient: {
    instance: {
      post: vi.fn(),
    },
    tokens: {
      clearAll: vi.fn(),
      scheduleProactiveRefresh: vi.fn(),
      setTokens: vi.fn(),
      setUser: vi.fn(),
    },
  },
}));

import { useDashboardPolling, useOrderPolling } from "../usePolling";

function setAuthContext(restaurantId: string | null) {
  const authStore = useAuthStore();
  Object.defineProperty(authStore, "isAuthenticated", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(authStore, "restaurantId", {
    value: restaurantId,
    configurable: true,
  });
}

function mountPolling<T>(factory: () => T) {
  let polling!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        polling = factory();
        return () => null;
      },
    }),
  );

  return { polling, wrapper };
}

describe("usePolling scoped requests", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: { success: true, data: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses canonical restaurantId for order polling", async () => {
    setAuthContext("rest-1");
    const { polling, wrapper } = mountPolling(() => useOrderPolling());

    polling.start();
    await flushPromises();
    polling.stop();
    wrapper.unmount();

    const url = String(mockApiGet.mock.calls[0]?.[0]);
    expect(url).toContain("/orders?");
    expect(url).toContain("restaurantId=rest-1");
    expect(url).toContain("status=pending%2Cconfirmed%2Cpreparing");
    expect(url).not.toContain("restaurant_id");
  });

  it("does not poll orders without a restaurant context", async () => {
    setAuthContext(null);
    const { polling, wrapper } = mountPolling(() => useOrderPolling());

    polling.start();
    await flushPromises();
    polling.stop();
    wrapper.unmount();

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(polling.data.value).toEqual([]);
  });

  it("uses canonical restaurantId for dashboard polling", async () => {
    setAuthContext("rest-1");
    const { polling, wrapper } = mountPolling(() => useDashboardPolling());

    polling.start();
    await flushPromises();
    polling.stop();
    wrapper.unmount();

    const url = String(mockApiGet.mock.calls[0]?.[0]);
    expect(url).toBe("/analytics/dashboard?restaurantId=rest-1");
  });
});
