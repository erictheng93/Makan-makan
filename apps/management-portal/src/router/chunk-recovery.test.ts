// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A deploy replaces every hashed chunk, so a tab opened before it asks for
// filenames that are gone. With no error view to fall back to, this app used
// to stop navigating and say nothing.

const CHUNK_ERROR = new TypeError(
  "Failed to fetch dynamically imported module: /assets/View-Ab12.js",
);

describe("management portal recovery from a stale build", () => {
  let assign: ReturnType<typeof vi.fn>;

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
   * Driving a real navigation is what proves the handler is attached; calling
   * the helper directly would pass whether or not it was ever wired up.
   */
  async function failNavigation(error: unknown) {
    const { router } = await import("@/router");
    router.addRoute({
      path: "/stale-chunk-probe",
      name: "StaleChunkProbe",
      component: () => Promise.reject(error),
      meta: { requiresAuth: false, public: true },
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

  // Someone is here in person and can refresh, so a second failure stalls
  // rather than reloading on a timer.
  it("only tries once for the same page", async () => {
    await failNavigation(CHUNK_ERROR);
    await failNavigation(CHUNK_ERROR);

    expect(assign).toHaveBeenCalledTimes(1);
  });
});
