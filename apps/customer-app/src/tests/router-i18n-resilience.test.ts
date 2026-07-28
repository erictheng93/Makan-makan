import { beforeAll, describe, expect, it, vi } from "vitest";

// #60: the production CSP blocks Vue I18n's eval-based message compiler, so
// every `t()` call threw. Because the router translates the page title inside
// `beforeEach`, that throw aborted the initial navigation and the app rendered
// nothing at all. The compiler flag is fixed in vite.config.ts; these tests
// cover the other half — a throwing i18n runtime must degrade, not blank out.

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    checkAuth: vi.fn(),
  }),
}));

vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      t: () => {
        throw new EvalError(
          "Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script",
        );
      },
    },
  },
}));

describe("router resilience against a broken i18n runtime", () => {
  beforeAll(() => {
    // Navigating for real resolves the route component, which loads the API
    // client, which requires this to be configured.
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8787/api/v1");
  });

  it("still completes navigation when translation throws", async () => {
    const { default: router } = await import("@/router");

    await router.push("/");
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("Home");
  });

  it("falls back to a static document title instead of aborting", async () => {
    const { default: router } = await import("@/router");

    await router.push("/");

    expect(document.title).toBe("MakanMasak");
  });

  it("safeTranslate returns the fallback rather than propagating", async () => {
    const { safeTranslate } = await import("@/utils/i18n");

    expect(safeTranslate("navigation.appTitle", "MakanMasak")).toBe(
      "MakanMasak",
    );
  });
});
