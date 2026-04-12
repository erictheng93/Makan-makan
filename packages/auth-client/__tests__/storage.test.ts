import { describe, it, expect, beforeEach } from "vitest";
import { createPrefixedStorage } from "../src/storage";

// Minimal localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("createPrefixedStorage", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should use prefixed keys for kitchen app", () => {
    const s = createPrefixedStorage("kitchen");

    s.setToken("tok123");
    expect(store["kitchen_auth_token"]).toBe("tok123");
    expect(s.getToken()).toBe("tok123");

    s.setRefreshToken("rt456");
    expect(store["kitchen_refresh_token"]).toBe("rt456");
    expect(s.getRefreshToken()).toBe("rt456");

    s.setUser({ id: 1, name: "Chef" });
    expect(store["kitchen_user"]).toBe('{"id":1,"name":"Chef"}');
    expect(s.getUser()).toEqual({ id: 1, name: "Chef" });
  });

  it("should produce auth_auth_token by default for auth prefix", () => {
    const s = createPrefixedStorage("auth");
    s.setToken("admin-tok");
    expect(store["auth_auth_token"]).toBe("admin-tok");
  });

  it("should support key overrides for non-standard keys", () => {
    const s = createPrefixedStorage("auth", {
      token: "auth_token",
      refreshToken: "auth_refresh_token",
      user: "auth_user",
    });
    s.setToken("admin-tok");
    expect(store["auth_token"]).toBe("admin-tok");
    expect(s.getToken()).toBe("admin-tok");

    s.setRefreshToken("admin-rt");
    expect(store["auth_refresh_token"]).toBe("admin-rt");

    s.setUser({ role: "admin" });
    expect(store["auth_user"]).toBe('{"role":"admin"}');
  });

  it("clearAll should remove all three keys", () => {
    const s = createPrefixedStorage("test");
    s.setToken("t");
    s.setRefreshToken("r");
    s.setUser({ x: 1 });
    expect(Object.keys(store)).toHaveLength(3);

    s.clearAll();
    expect(s.getToken()).toBeNull();
    expect(s.getRefreshToken()).toBeNull();
    expect(s.getUser()).toBeNull();
  });

  it("getUser should return null for invalid JSON", () => {
    const s = createPrefixedStorage("bad");
    store["bad_user"] = "not-json";
    expect(s.getUser()).toBeNull();
  });

  it("setUser with null should remove the key", () => {
    const s = createPrefixedStorage("x");
    s.setUser({ a: 1 });
    expect(s.getUser()).toEqual({ a: 1 });

    s.setUser(null);
    expect(s.getUser()).toBeNull();
  });
});
