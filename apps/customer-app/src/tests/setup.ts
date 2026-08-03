import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "scrollTo", {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  // Files that opt into `@vitest-environment node` have no DOM storage.
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
