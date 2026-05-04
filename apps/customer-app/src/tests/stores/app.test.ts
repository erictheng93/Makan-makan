import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAppStore } from "@/stores/app";
import { PlanType, Status } from "@makanmasak/shared-types";
import type { Restaurant } from "@makanmasak/shared-types";

const buildRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: "rest-1",
  name: "Test",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: Status.ACTIVE,
  planType: PlanType.BASIC,
  ...overrides,
});

// Mock i18n
vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

describe("app store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
  });

  // ──────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────

  describe("initial state", () => {
    it("should start with default values", () => {
      const store = useAppStore();
      expect(store.currentRestaurant).toBeNull();
      expect(store.currentTableId).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.isInstallable).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Computed getters
  // ──────────────────────────────────────────────

  describe("computed getters", () => {
    it("hasRestaurantContext should be falsy when no restaurant is set", () => {
      const store = useAppStore();
      expect(store.hasRestaurantContext).toBeFalsy();
    });

    it("hasRestaurantContext should be truthy when both restaurant and table are set", () => {
      const store = useAppStore();
      const mockRestaurant = buildRestaurant();
      store.setRestaurantContext(mockRestaurant, 1);
      expect(store.hasRestaurantContext).toBeTruthy();
    });

    it("isOfflineMode should reflect online status", () => {
      const store = useAppStore();
      // jsdom default: navigator.onLine may vary; test the computed logic
      store.isOnline = false;
      expect(store.isOfflineMode).toBe(true);

      store.isOnline = true;
      expect(store.isOfflineMode).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // setRestaurantContext / clearRestaurantContext
  // ──────────────────────────────────────────────

  describe("setRestaurantContext", () => {
    it("should set restaurant and tableId", () => {
      const store = useAppStore();
      const restaurant = buildRestaurant({ name: "Burger Shop" });
      store.setRestaurantContext(restaurant, 5);

      expect(store.currentRestaurant).toEqual(
        expect.objectContaining({ id: "rest-1" }),
      );
      expect(store.currentTableId).toBe(5);
    });

    it("should persist context to localStorage", () => {
      const store = useAppStore();
      const restaurant = buildRestaurant();
      store.setRestaurantContext(restaurant, 3);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "makanmasak_restaurant_context",
        expect.any(String),
      );
      const calls = (window.localStorage.setItem as ReturnType<typeof vi.fn>)
        .mock.calls;
      const savedCall = calls.find(
        (c: any) => c[0] === "makanmasak_restaurant_context",
      );
      const saved = JSON.parse(savedCall![1]);
      expect(saved.restaurant.id).toBe("rest-1");
      expect(saved.tableId).toBe(3);
      expect(saved.timestamp).toEqual(expect.any(Number));
    });
  });

  describe("clearRestaurantContext", () => {
    it("should clear restaurant state and localStorage", () => {
      const store = useAppStore();
      store.setRestaurantContext(buildRestaurant({ id: "r1", name: "T" }), 1);
      store.clearRestaurantContext();

      expect(store.currentRestaurant).toBeNull();
      expect(store.currentTableId).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "makanmasak_restaurant_context",
      );
    });
  });

  // ──────────────────────────────────────────────
  // restoreContext
  // ──────────────────────────────────────────────

  describe("restoreContext", () => {
    it("should restore context from localStorage", async () => {
      const saved = JSON.stringify({
        restaurant: { id: "rest-2", name: "Pizza Place" },
        tableId: 7,
        timestamp: Date.now(),
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((key: string) =>
        key === "makanmasak_restaurant_context" ? saved : null,
      );

      const store = useAppStore();
      await store.restoreContext();

      expect(store.currentRestaurant).toEqual(
        expect.objectContaining({ id: "rest-2" }),
      );
      expect(store.currentTableId).toBe(7);
    });

    it("should discard expired context (>24 hours)", async () => {
      const saved = JSON.stringify({
        restaurant: { id: "rest-old", name: "Old" },
        tableId: 1,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      });
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((key: string) =>
        key === "makanmasak_restaurant_context" ? saved : null,
      );

      const store = useAppStore();
      await store.restoreContext();

      expect(store.currentRestaurant).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "makanmasak_restaurant_context",
      );
    });

    it("should handle corrupted JSON gracefully", async () => {
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((key: string) =>
        key === "makanmasak_restaurant_context" ? "NOT JSON" : null,
      );

      const store = useAppStore();
      await store.restoreContext();

      expect(store.currentRestaurant).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "makanmasak_restaurant_context",
      );
    });
  });

  // ──────────────────────────────────────────────
  // setLoading / setError / clearError
  // ──────────────────────────────────────────────

  describe("utility actions", () => {
    it("setLoading should update isLoading", () => {
      const store = useAppStore();
      store.setLoading(true);
      expect(store.isLoading).toBe(true);
      store.setLoading(false);
      expect(store.isLoading).toBe(false);
    });

    it("setError should update error", () => {
      const store = useAppStore();
      store.setError("Something broke");
      expect(store.error).toBe("Something broke");
    });

    it("clearError should set error to null", () => {
      const store = useAppStore();
      store.setError("An error");
      store.clearError();
      expect(store.error).toBeNull();
    });
  });
});
