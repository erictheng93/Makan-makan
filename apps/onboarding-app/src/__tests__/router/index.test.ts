/**
 * Tests for Router Configuration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the router configuration by importing the module directly
// but we need to mock vue-router to avoid actual router creation
let capturedRoutes: any[] = [];
let capturedGuards: any[] = [];

vi.mock("vue-router", async () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    beforeEach: vi.fn((fn) => {
      capturedGuards.push(fn);
    }),
    afterEach: vi.fn(),
    install: vi.fn(),
    get _routes() {
      return capturedRoutes;
    },
    get _guards() {
      return capturedGuards;
    },
  };

  return {
    createRouter: vi.fn((options) => {
      capturedRoutes.push(...options.routes);
      return mockRouter;
    }),
    createWebHistory: vi.fn(() => "webHistory"),
    __mockRouter: mockRouter,
  };
});

describe("Router", () => {
  let routerModule: any;

  beforeEach(async () => {
    capturedRoutes = [];
    capturedGuards = [];
    vi.resetModules();
    routerModule = await import("@/router/index");
  });

  describe("route definitions", () => {
    it("should define a Home route at /", () => {
      const router = routerModule.router;
      const routes = router._routes || [];

      const homeRoute = routes.find((r: any) => r.path === "/");
      expect(homeRoute).toBeDefined();
      expect(homeRoute.name).toBe("Home");
      expect(homeRoute.meta.title).toBe("獨立部署申請");
    });

    it("should define an Apply route at /apply", () => {
      const router = routerModule.router;
      const routes = router._routes || [];

      const applyRoute = routes.find((r: any) => r.path === "/apply");
      expect(applyRoute).toBeDefined();
      expect(applyRoute.name).toBe("Apply");
      expect(applyRoute.meta.title).toBe("填寫申請");
    });

    it("should define a Connect route at /connect", () => {
      const router = routerModule.router;
      const routes = router._routes || [];

      const connectRoute = routes.find((r: any) => r.path === "/connect");
      expect(connectRoute).toBeDefined();
      expect(connectRoute.name).toBe("Connect");
      expect(connectRoute.meta.title).toBe("連接 Cloudflare");
    });

    it("should define a Success route at /success", () => {
      const router = routerModule.router;
      const routes = router._routes || [];

      const successRoute = routes.find((r: any) => r.path === "/success");
      expect(successRoute).toBeDefined();
      expect(successRoute.name).toBe("Success");
      expect(successRoute.meta.title).toBe("申請成功");
    });

    it("should have exactly 4 routes", () => {
      const router = routerModule.router;
      const routes = router._routes || [];
      expect(routes.length).toBe(4);
    });

    it("should use lazy loading for all route components", () => {
      const router = routerModule.router;
      const routes = router._routes || [];

      routes.forEach((route: any) => {
        // Lazy-loaded components are functions
        expect(typeof route.component).toBe("function");
      });
    });
  });

  describe("navigation guard", () => {
    it("should register a beforeEach guard", () => {
      const router = routerModule.router;
      expect(router.beforeEach).toHaveBeenCalled();
    });

    it("should set document title based on route meta", () => {
      const router = routerModule.router;
      const guards = router._guards || [];

      expect(guards.length).toBeGreaterThan(0);

      const guard = guards[0];
      const mockNext = vi.fn();

      // Simulate navigation to Apply page
      guard({ meta: { title: "填寫申請" } }, { meta: {} }, mockNext);

      expect(document.title).toBe("填寫申請 - MakanMakan");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should set default title when no meta.title", () => {
      const router = routerModule.router;
      const guards = router._guards || [];
      const guard = guards[0];
      const mockNext = vi.fn();

      guard({ meta: {} }, { meta: {} }, mockNext);

      expect(document.title).toBe("MakanMakan 獨立部署");
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
