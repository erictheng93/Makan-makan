/**
 * Tests for code splitting utilities
 * Tests ComponentLoader, FeatureLoader, and helper functions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ComponentLoader,
  FeatureLoader,
  createRouteComponents,
  createChunkName,
  createVendorChunks,
} from "../utils/codeSplitting";

describe("ComponentLoader", () => {
  let loader: ComponentLoader;
  const mockComponents = {
    Dashboard: vi.fn().mockResolvedValue({ default: { name: "Dashboard" } }),
    Settings: vi.fn().mockResolvedValue({ default: { name: "Settings" } }),
    Failing: vi.fn().mockRejectedValue(new Error("Load failed")),
  };

  beforeEach(() => {
    // Reset mocks
    Object.values(mockComponents).forEach((fn) => fn.mockClear());
    mockComponents.Dashboard.mockResolvedValue({
      default: { name: "Dashboard" },
    });
    mockComponents.Settings.mockResolvedValue({
      default: { name: "Settings" },
    });
    mockComponents.Failing.mockRejectedValue(new Error("Load failed"));
    loader = new ComponentLoader(mockComponents);
  });

  describe("load", () => {
    it("loads a component by name", async () => {
      const component = await loader.load("Dashboard");
      expect(component).toEqual({ name: "Dashboard" });
    });

    it("returns cached component on second load", async () => {
      await loader.load("Dashboard");
      await loader.load("Dashboard");
      // The actual loader should only be called once
      expect(mockComponents.Dashboard).toHaveBeenCalledTimes(1);
    });

    it("throws when component name is not found", async () => {
      await expect(loader.load("NonExistent")).rejects.toThrow(
        'Component "NonExistent" not found',
      );
    });

    it("removes from cache on load failure", async () => {
      await expect(loader.load("Failing")).rejects.toThrow("Load failed");

      // After failure, cache should be cleared for that component
      // A retry should call the loader again
      mockComponents.Failing.mockResolvedValueOnce({
        default: { name: "Recovered" },
      });
      const result = await loader.load("Failing");
      expect(result).toEqual({ name: "Recovered" });
    });

    it("handles modules without default export", async () => {
      mockComponents.Dashboard.mockResolvedValueOnce({ name: "DirectExport" });
      const component = await loader.load("Dashboard");
      expect(component).toEqual({ name: "DirectExport" });
    });
  });

  describe("preload", () => {
    it("queues component for preloading", () => {
      // Mock requestIdleCallback
      const mockRIC = vi.fn((cb: () => void) => cb());
      vi.stubGlobal("requestIdleCallback", mockRIC);

      loader.preload("Settings");

      expect(mockRIC).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("does not preload already cached components", async () => {
      await loader.load("Dashboard"); // Cache it

      const mockRIC = vi.fn((cb: () => void) => cb());
      vi.stubGlobal("requestIdleCallback", mockRIC);

      loader.preload("Dashboard");
      // Should not trigger requestIdleCallback since already cached
      expect(mockRIC).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe("preloadMultiple", () => {
    it("queues multiple components for preloading", () => {
      const mockRIC = vi.fn((cb: () => void) => cb());
      vi.stubGlobal("requestIdleCallback", mockRIC);

      loader.preloadMultiple(["Dashboard", "Settings"]);

      // At least one requestIdleCallback call
      expect(mockRIC).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe("clearCache", () => {
    it("clears specific component from cache", async () => {
      await loader.load("Dashboard");
      loader.clearCache("Dashboard");

      // Loading again should call the loader
      await loader.load("Dashboard");
      expect(mockComponents.Dashboard).toHaveBeenCalledTimes(2);
    });

    it("clears all cache when no name given", async () => {
      await loader.load("Dashboard");
      await loader.load("Settings");
      loader.clearCache();

      await loader.load("Dashboard");
      await loader.load("Settings");
      expect(mockComponents.Dashboard).toHaveBeenCalledTimes(2);
      expect(mockComponents.Settings).toHaveBeenCalledTimes(2);
    });
  });

  describe("getCacheStats", () => {
    it("returns correct stats after loading", async () => {
      await loader.load("Dashboard");

      const stats = loader.getCacheStats();
      expect(stats.cached).toBe(1);
      expect(stats.available).toBe(3); // Dashboard, Settings, Failing
      expect(stats.loading).toBe(0);
    });

    it("returns zero stats initially", () => {
      const stats = loader.getCacheStats();
      expect(stats.cached).toBe(0);
      expect(stats.preloadQueue).toBe(0);
      expect(stats.loading).toBe(0);
    });
  });
});

describe("FeatureLoader", () => {
  let featureLoader: FeatureLoader;

  beforeEach(() => {
    featureLoader = new FeatureLoader();
  });

  describe("register and loadFeature", () => {
    it("registers and loads a feature", async () => {
      const mockLoader = vi.fn().mockResolvedValue(undefined);
      featureLoader.register("webgl", mockLoader);

      const result = await featureLoader.loadFeature("webgl");
      expect(result).toBe(true);
      expect(mockLoader).toHaveBeenCalledOnce();
    });

    it("returns false for unregistered feature", async () => {
      const result = await featureLoader.loadFeature("nonexistent");
      expect(result).toBe(false);
    });

    it("skips loading when feature is not supported", async () => {
      const mockLoader = vi.fn();
      featureLoader.register("webxr", mockLoader, () => false);

      const result = await featureLoader.loadFeature("webxr");
      expect(result).toBe(false);
      expect(mockLoader).not.toHaveBeenCalled();
    });

    it("loads feature when detector returns true", async () => {
      const mockLoader = vi.fn().mockResolvedValue(undefined);
      featureLoader.register("canvas", mockLoader, () => true);

      const result = await featureLoader.loadFeature("canvas");
      expect(result).toBe(true);
      expect(mockLoader).toHaveBeenCalledOnce();
    });

    it("does not load same feature twice", async () => {
      const mockLoader = vi.fn().mockResolvedValue(undefined);
      featureLoader.register("analytics", mockLoader);

      await featureLoader.loadFeature("analytics");
      await featureLoader.loadFeature("analytics");

      expect(mockLoader).toHaveBeenCalledOnce();
    });

    it("returns false when loader throws", async () => {
      const mockLoader = vi
        .fn()
        .mockRejectedValue(new Error("Feature init failed"));
      featureLoader.register("broken", mockLoader);

      const result = await featureLoader.loadFeature("broken");
      expect(result).toBe(false);
    });
  });

  describe("loadFeatures", () => {
    it("loads multiple features in parallel", async () => {
      featureLoader.register("a", vi.fn().mockResolvedValue(undefined));
      featureLoader.register("b", vi.fn().mockResolvedValue(undefined));
      featureLoader.register("c", vi.fn().mockRejectedValue(new Error("fail")));

      const results = await featureLoader.loadFeatures(["a", "b", "c"]);
      expect(results.a).toBe(true);
      expect(results.b).toBe(true);
      expect(results.c).toBe(false);
    });
  });

  describe("isLoaded", () => {
    it("returns false for unloaded feature", () => {
      featureLoader.register("lazy", vi.fn().mockResolvedValue(undefined));
      expect(featureLoader.isLoaded("lazy")).toBe(false);
    });

    it("returns true for loaded feature", async () => {
      featureLoader.register("ready", vi.fn().mockResolvedValue(undefined));
      await featureLoader.loadFeature("ready");
      expect(featureLoader.isLoaded("ready")).toBe(true);
    });
  });
});

describe("createChunkName", () => {
  it("generates webpack magic comment", () => {
    const result = createChunkName("my-chunk");
    expect(result).toBe('/* webpackChunkName: "my-chunk" */');
  });
});

describe("createVendorChunks", () => {
  it("returns vendor chunk config", () => {
    const chunks = createVendorChunks();
    expect(chunks).toHaveProperty("vue");
    expect(chunks).toHaveProperty("ui");
    expect(chunks).toHaveProperty("utils");
    expect(chunks).toHaveProperty("vendor");
  });

  it("vue chunk has highest priority", () => {
    const chunks = createVendorChunks();
    expect(chunks.vue.priority).toBeGreaterThan(chunks.ui.priority);
    expect(chunks.vue.priority).toBeGreaterThan(chunks.utils.priority);
    expect(chunks.vue.priority).toBeGreaterThan(chunks.vendor.priority);
  });

  it("all chunks target 'all'", () => {
    const chunks = createVendorChunks();
    Object.values(chunks).forEach((chunk) => {
      expect(chunk.chunks).toBe("all");
    });
  });
});

describe("createRouteComponents", () => {
  it("creates lazy components from route map", () => {
    const routes = {
      home: vi.fn().mockResolvedValue({ default: { name: "Home" } }),
      about: vi.fn().mockResolvedValue({ default: { name: "About" } }),
    };

    const result = createRouteComponents(routes);
    expect(Object.keys(result)).toEqual(["home", "about"]);
    // Each should be a component (object with setup/template)
    expect(result.home).toBeDefined();
    expect(result.about).toBeDefined();
  });
});
