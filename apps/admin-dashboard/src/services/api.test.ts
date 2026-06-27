// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAdminAuthStorage,
  getAdminTokenStorageMode,
  handleAdminAuthFailure,
} from "./api";

describe("admin API auth storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

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

  it("clears stale admin auth state from both browser storage scopes", () => {
    localStorage.setItem("auth_token", "stale-local-token");
    localStorage.setItem("auth_refresh_token", "stale-local-refresh");
    localStorage.setItem("auth_user", '{"id":"local-user"}');
    sessionStorage.setItem("auth_token", "stale-session-token");
    sessionStorage.setItem("auth_refresh_token", "stale-session-refresh");
    sessionStorage.setItem("auth_user", '{"id":"session-user"}');

    clearAdminAuthStorage();

    for (const key of ["auth_token", "auth_refresh_token", "auth_user"]) {
      expect(localStorage.getItem(key)).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    }
  });

  it("redirects to login once after refresh failure", () => {
    const location = {
      pathname: "/dashboard/platform",
      assign: vi.fn(),
    };

    localStorage.setItem("auth_token", "stale-local-token");
    sessionStorage.setItem("auth_token", "stale-session-token");

    handleAdminAuthFailure(location);
    handleAdminAuthFailure(location);

    expect(location.assign).toHaveBeenCalledTimes(1);
    expect(location.assign).toHaveBeenCalledWith("/login");
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("auth_token")).toBeNull();
  });
});
