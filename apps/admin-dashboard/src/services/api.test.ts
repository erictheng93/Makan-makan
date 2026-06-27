// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { getAdminTokenStorageMode } from "./api";

describe("admin API auth storage", () => {
  it("keeps production admin access tokens in memory", () => {
    expect(getAdminTokenStorageMode({ DEV: false } as ImportMetaEnv)).toBe(
      "memory",
    );
  });

  it("uses sessionStorage only in dev to survive Vite full reloads", () => {
    expect(getAdminTokenStorageMode({ DEV: true } as ImportMetaEnv)).toBe(
      "sessionStorage",
    );
  });
});
