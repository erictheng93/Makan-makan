/**
 * @vitest-environment jsdom
 *
 * The module under test only ever runs in a browser app — it reads
 * sessionStorage and replaces the document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearChunkRecoveryMark,
  createChunkRecovery,
  isChunkLoadFailure,
} from "./chunk-recovery";

function wrap(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as { cause?: unknown }).cause = cause;
  return error;
}

const CHUNK_ERROR = new TypeError(
  "Failed to fetch dynamically imported module: https://example.com/assets/View-Ab12.js",
);

describe("chunk load detection", () => {
  it("recognises the wordings browsers actually use", () => {
    expect(isChunkLoadFailure(CHUNK_ERROR)).toBe(true);
    expect(
      isChunkLoadFailure(
        new Error("error loading dynamically imported module: /a.js"),
      ),
    ).toBe(true);
    expect(
      isChunkLoadFailure(new Error("Importing a module script failed.")),
    ).toBe(true);
  });

  // Whatever catches the import wraps it, so the marker is rarely on top.
  // `cause` is assigned rather than passed to the constructor: the apps that
  // consume this do not all compile against an ES2022 lib.
  it("finds the failure through the wrapper that caught it", () => {
    expect(isChunkLoadFailure(wrap("boom", CHUNK_ERROR))).toBe(true);
    expect(isChunkLoadFailure(wrap("outer", wrap("inner", CHUNK_ERROR)))).toBe(
      true,
    );
  });

  it("leaves ordinary errors alone", () => {
    expect(isChunkLoadFailure(new Error("the view threw during setup"))).toBe(
      false,
    );
    expect(isChunkLoadFailure(null)).toBe(false);
    expect(isChunkLoadFailure("not an error")).toBe(false);
  });

  // A cause chain can be circular; the walk must end either way.
  it("stops walking rather than following a cycle", () => {
    const a = new Error("a");
    const b = wrap("b", a);
    (a as { cause?: unknown }).cause = b;

    expect(isChunkLoadFailure(a)).toBe(false);
  });
});

describe("chunk recovery", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00Z"));
    sessionStorage.clear();
    assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches the document again for the page that was wanted", () => {
    const recover = createChunkRecovery({ storageKey: "app" });

    expect(recover(CHUNK_ERROR, { fullPath: "/orders/42" })).toBe(true);
    expect(assign).toHaveBeenCalledWith("/orders/42");
  });

  it("declines anything that is not a chunk failure", () => {
    const recover = createChunkRecovery({ storageKey: "app" });

    expect(recover(new Error("the view threw"), { fullPath: "/" })).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  // The caller needs the false to know it should show a person something.
  it("gives up on the second failure when no retry window is set", () => {
    const recover = createChunkRecovery({ storageKey: "app" });

    recover(CHUNK_ERROR, { fullPath: "/orders/42" });
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(recover(CHUNK_ERROR, { fullPath: "/orders/42" })).toBe(false);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("waits out the retry window before trying a failing page again", () => {
    const recover = createChunkRecovery({
      storageKey: "kds",
      retryAfterMs: 60_000,
    });

    recover(CHUNK_ERROR, { fullPath: "/kitchen/42" });
    vi.advanceTimersByTime(59_000);
    expect(recover(CHUNK_ERROR, { fullPath: "/kitchen/42" })).toBe(false);

    vi.advanceTimersByTime(2_000);
    expect(recover(CHUNK_ERROR, { fullPath: "/kitchen/42" })).toBe(true);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  // A spent attempt on one page says nothing about a different one.
  it("tracks the attempt per page", () => {
    const recover = createChunkRecovery({ storageKey: "app" });

    recover(CHUNK_ERROR, { fullPath: "/orders/42" });
    expect(recover(CHUNK_ERROR, { fullPath: "/menu" })).toBe(true);
    expect(assign).toHaveBeenLastCalledWith("/menu");
  });

  it("keeps two apps on one origin out of each other's way", () => {
    const admin = createChunkRecovery({ storageKey: "admin" });
    const kitchen = createChunkRecovery({ storageKey: "kitchen" });

    admin.call(null, CHUNK_ERROR, { fullPath: "/shared-path" });
    expect(kitchen(CHUNK_ERROR, { fullPath: "/shared-path" })).toBe(true);
  });

  it("does nothing at all when storage refuses to record the attempt", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("kiosk mode");
    });
    const recover = createChunkRecovery({ storageKey: "app" });

    expect(recover(CHUNK_ERROR, { fullPath: "/orders/42" })).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("forgets the attempt once a navigation succeeds", () => {
    const recover = createChunkRecovery({ storageKey: "app" });

    recover(CHUNK_ERROR, { fullPath: "/orders/42" });
    clearChunkRecoveryMark("app");

    expect(recover(CHUNK_ERROR, { fullPath: "/orders/42" })).toBe(true);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("falls back to the current path when the target is unknown", () => {
    vi.stubGlobal("location", { assign, pathname: "/dashboard" });
    const recover = createChunkRecovery({ storageKey: "app" });

    expect(recover(CHUNK_ERROR, null)).toBe(true);
    expect(assign).toHaveBeenCalledWith("/dashboard");
  });
});
