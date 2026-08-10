import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Router } from "vue-router";
import {
  installKitchenChunkRecovery,
  isChunkLoadFailure,
} from "./chunk-recovery";

// A deploy replaces every hashed chunk, so a screen still holding the previous
// index.html requests filenames that are gone. Nobody is standing in front of
// this display to notice, which is why it reloads itself — and why it must not
// reload in a loop while a deploy is still settling.

const CHUNK_ERROR = new TypeError(
  "Failed to fetch dynamically imported module: https://kitchen.makanmasak.com/assets/EnhancedKitchenDashboard-Ab12.js",
);

/**
 * A stand-in for the router: the real one only reaches onError through a
 * genuine navigation failure, and all this needs is the handler it registers.
 */
function fakeRouter() {
  const errorHandlers: Array<(error: unknown, to?: unknown) => void> = [];
  const afterHooks: Array<() => void> = [];

  return {
    router: {
      onError: (handler: (error: unknown, to?: unknown) => void) =>
        errorHandlers.push(handler),
      afterEach: (hook: () => void) => afterHooks.push(hook),
    } as unknown as Router,
    fail: (error: unknown, to?: unknown) =>
      errorHandlers.forEach((handler) => handler(error, to)),
    navigate: () => afterHooks.forEach((hook) => hook()),
  };
}

describe("kitchen display recovery from a stale build", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00Z"));
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("recognises an import failure through the wrapper that caught it", () => {
    expect(isChunkLoadFailure(CHUNK_ERROR)).toBe(true);
    expect(isChunkLoadFailure(new Error("boom", { cause: CHUNK_ERROR }))).toBe(
      true,
    );
    expect(isChunkLoadFailure(new Error("the dashboard threw"))).toBe(false);
  });

  it("reloads to the page the display was heading for", () => {
    const { router, fail } = fakeRouter();
    installKitchenChunkRecovery(router);

    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });

    expect(assign).toHaveBeenCalledWith("/kitchen/42");
  });

  it("does not spin while a deploy is still settling", () => {
    const { router, fail } = fakeRouter();
    installKitchenChunkRecovery(router);

    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });
    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });
    vi.advanceTimersByTime(59_000);
    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });

    expect(assign).toHaveBeenCalledTimes(1);
  });

  // Unlike a diner's phone, this screen has nobody to press refresh, so the
  // cooldown expiring has to mean "try again", not "give up".
  it("tries again once the cooldown has passed", () => {
    const { router, fail } = fakeRouter();
    installKitchenChunkRecovery(router);

    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });
    vi.advanceTimersByTime(61_000);
    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("leaves ordinary navigation failures alone", () => {
    const { router, fail } = fakeRouter();
    installKitchenChunkRecovery(router);

    fail(new Error("the dashboard threw during setup"), {
      fullPath: "/kitchen/42",
    });

    expect(assign).not.toHaveBeenCalled();
  });

  it("forgets the mark once a navigation succeeds", () => {
    const { router, fail, navigate } = fakeRouter();
    installKitchenChunkRecovery(router);

    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });
    navigate();
    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });

    // The next deploy earns its own immediate reload rather than waiting out
    // a cooldown left over from the previous one.
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when storage is unavailable", () => {
    const { router, fail } = fakeRouter();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("kiosk mode");
    });
    installKitchenChunkRecovery(router);

    fail(CHUNK_ERROR, { fullPath: "/kitchen/42" });

    // Without somewhere to record the attempt there is no way to bound the
    // retries, and an unbounded reload loop is worse than a stalled screen.
    expect(assign).not.toHaveBeenCalled();
  });
});
