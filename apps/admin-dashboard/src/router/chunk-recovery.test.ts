// @vitest-environment jsdom

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// A deploy replaces every hashed chunk, so a dashboard left open asks for
// filenames that are gone. With no error view to fall back to, the app used to
// simply stop navigating and say nothing.

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ isAuthenticated: false, checkAuth: vi.fn() }),
}));

const CHUNK_ERROR = new TypeError(
  "Failed to fetch dynamically imported module: https://admin.makanmasak.com/assets/OrdersView-Ab12.js",
);

describe("admin dashboard recovery from a stale build", () => {
  let assign: ReturnType<typeof vi.fn>;

  // The first import of @/router pulls in every view component; transforming
  // that graph can alone eat the 5s test timeout on a loaded machine (#211) —
  // and a test that times out mid-navigation leaks its pending location.assign
  // into the next test. Warm the transform cache under the hook's own budget.
  beforeAll(async () => {
    await import("@/router");
    vi.resetModules();
  }, 30_000);

  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * Driving a real navigation is what proves the handler is actually attached;
   * calling the helper directly would pass even if nothing were wired up.
   */
  async function failNavigation(error: unknown) {
    const { router } = await import("@/router");
    router.addRoute({
      path: "/stale-chunk-probe",
      name: "StaleChunkProbe",
      component: () => Promise.reject(error),
      meta: { requiresAuth: false },
    });

    await router.push("/stale-chunk-probe").catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("fetches the document again for the page that was wanted", async () => {
    await failNavigation(CHUNK_ERROR);

    expect(assign).toHaveBeenCalledWith("/stale-chunk-probe");
  });

  it("leaves an ordinary navigation failure alone", async () => {
    await failNavigation(new Error("the view threw during setup"));

    expect(assign).not.toHaveBeenCalled();
  });

  // Someone is sitting in front of this screen and can refresh, so a second
  // failure should stall rather than reload on a timer.
  it("only tries once for the same page", async () => {
    await failNavigation(CHUNK_ERROR);
    await failNavigation(CHUNK_ERROR);

    expect(assign).toHaveBeenCalledTimes(1);
  });
});
