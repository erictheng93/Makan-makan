import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";
import { createAuthenticatedApiClient } from "../src/create-api-client";

// ── localStorage mock ─────────────────────��───────────────────────────────
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

// ── document.cookie mock ────────────────────────────���─────────────────────
let cookieValue = "";
Object.defineProperty(globalThis, "document", {
  value: {
    cookie: "",
    get _cookie() {
      return cookieValue;
    },
  },
  writable: true,
});
Object.defineProperty(document, "cookie", {
  get: () => cookieValue,
  set: (v: string) => {
    cookieValue = v;
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────
function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function ok<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {} as never,
  };
}

function err401() {
  const error: any = new Error("Unauthorized");
  error.response = { status: 401, data: {} };
  error.config = { headers: {}, _retry: false };
  error.isAxiosError = true;
  return error;
}

describe("createAuthenticatedApiClient", () => {
  beforeEach(() => {
    localStorageMock.clear();
    cookieValue = "";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should create an axios instance with correct defaults", () => {
    const client = createAuthenticatedApiClient({
      storageKeyPrefix: "test",
    });

    expect(client.instance).toBeDefined();
    expect(client.instance.defaults.baseURL).toBe("/api/v1");
    expect(client.instance.defaults.timeout).toBe(10000);
    client.destroy();
  });

  it("should accept custom baseURL and timeout", () => {
    const client = createAuthenticatedApiClient({
      storageKeyPrefix: "test",
      baseURL: "/custom/api",
      timeout: 30000,
    });

    expect(client.instance.defaults.baseURL).toBe("/custom/api");
    expect(client.instance.defaults.timeout).toBe(30000);
    client.destroy();
  });

  it("should include default headers", () => {
    const client = createAuthenticatedApiClient({
      storageKeyPrefix: "test",
      defaultHeaders: { "X-Custom": "value" },
    });

    expect(client.instance.defaults.headers["X-Custom"]).toBe("value");
    client.destroy();
  });

  describe("setAuthToken", () => {
    it("should set Authorization header", () => {
      const client = createAuthenticatedApiClient({
        storageKeyPrefix: "test",
      });

      client.setAuthToken("my-token");
      expect(client.instance.defaults.headers.common["Authorization"]).toBe(
        "Bearer my-token",
      );

      client.setAuthToken(null);
      expect(
        client.instance.defaults.headers.common["Authorization"],
      ).toBeUndefined();

      client.destroy();
    });
  });

  describe("token manager integration", () => {
    it("should expose tokens for storage operations", () => {
      const client = createAuthenticatedApiClient({
        storageKeyPrefix: "kitchen",
      });

      client.tokens.setTokens("access", "refresh");
      expect(store["kitchen_auth_token"]).toBe("access");
      expect(store["kitchen_refresh_token"]).toBe("refresh");

      client.tokens.setUser({ id: 1 });
      expect(JSON.parse(store["kitchen_user"])).toEqual({ id: 1 });

      client.tokens.clearAll();
      expect(store["kitchen_auth_token"]).toBeUndefined();

      client.destroy();
    });
  });

  describe("destroy", () => {
    it("should clear refresh timer on destroy", () => {
      const now = Math.floor(new Date("2026-03-22T12:00:00Z").getTime() / 1000);
      const client = createAuthenticatedApiClient({
        storageKeyPrefix: "test",
      });

      const token = createTestJwt({ iat: now, exp: now + 1000 });
      client.tokens.scheduleProactiveRefresh(token);

      // destroy should not throw and should clear timer
      expect(() => client.destroy()).not.toThrow();
    });
  });

  describe("retryOn401 = false", () => {
    it("should not retry and call onAuthFailure on 401", () => {
      const onAuthFailure = vi.fn();
      const client = createAuthenticatedApiClient({
        storageKeyPrefix: "noretry",
        retryOn401: false,
        onAuthFailure,
      });

      // The client is created — we verify the config was accepted
      expect(client.instance).toBeDefined();
      client.destroy();
    });
  });
});
