import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  // Files that opt into `@vitest-environment node` have no DOM storage.
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
