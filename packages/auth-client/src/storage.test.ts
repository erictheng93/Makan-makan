import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrefixedStorage } from "./storage";

function installLocalStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  });
}

describe("createPrefixedStorage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installLocalStorage();
  });

  it("stores auth values using the default prefixed keys", () => {
    const storage = createPrefixedStorage("customer");

    storage.setToken("token-1");
    storage.setRefreshToken("refresh-1");
    storage.setUser({ id: "user-1" });

    expect(localStorage.getItem("customer_auth_token")).toBe("token-1");
    expect(localStorage.getItem("customer_refresh_token")).toBe("refresh-1");
    expect(storage.getUser<{ id: string }>()).toEqual({ id: "user-1" });

    storage.clearAll();
    expect(storage.getToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getUser()).toBeNull();
  });

  it("supports app-specific key overrides and invalid user JSON", () => {
    const storage = createPrefixedStorage("auth", {
      token: "auth_token",
      refreshToken: "auth_refresh_token",
      user: "auth_user",
    });

    localStorage.setItem("auth_user", "{bad json");
    storage.setToken("token-2");

    expect(storage.getToken()).toBe("token-2");
    expect(storage.getUser()).toBeNull();
  });
});
