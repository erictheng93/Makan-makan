import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedApiClient } from "./create-api-client";

// #66: the CSRF token used to live only in a module variable, so a page reload
// wiped it and the next state-changing request went out with no token. The
// cookie fallback cannot cover that — the API sets a `__Host-` prefixed cookie,
// which is host-only on the API origin, and every front-end is served from a
// different subdomain, so document.cookie never sees it.

const CSRF_STORAGE_KEY = "mm_csrf_token";
const TOKEN = "a".repeat(64);

function installStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  });
  return values;
}

function buildClient() {
  return createAuthenticatedApiClient({
    baseURL: "https://api.test/api/v1",
    storageKeyPrefix: "auth",
    storageKeys: {
      token: "auth_token",
      refreshToken: "auth_refresh_token",
      user: "auth_user",
    },
    csrf: true,
  });
}

describe("auth client CSRF token persistence", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("document", { cookie: "" });
  });

  it("persists a token received on a response header", async () => {
    const values = installStorage();
    const client = buildClient();

    // Simulate the login response that carries the token.
    const responseInterceptor = (
      client.instance.interceptors.response as unknown as {
        handlers: Array<{ fulfilled: (r: unknown) => unknown }>;
      }
    ).handlers[0];
    responseInterceptor.fulfilled({
      headers: { "x-csrf-token": TOKEN },
    });

    expect(values.get(CSRF_STORAGE_KEY)).toBe(TOKEN);
  });

  it("sends a token that a previous page load stored", async () => {
    installStorage({ [CSRF_STORAGE_KEY]: TOKEN, auth_token: "bearer" });
    const client = buildClient();

    const requestInterceptor = (
      client.instance.interceptors.request as unknown as {
        handlers: Array<{
          fulfilled: (c: unknown) => { headers: Record<string, string> };
        }>;
      }
    ).handlers[0];
    const config = requestInterceptor.fulfilled({
      method: "post",
      headers: {} as Record<string, string>,
    });

    // Nothing was cached in memory this page load — without persistence the
    // header would be absent and the request would 403.
    expect(config.headers["X-CSRF-Token"]).toBe(TOKEN);
  });

  it("does not attach a token to safe methods", async () => {
    installStorage({ [CSRF_STORAGE_KEY]: TOKEN });
    const client = buildClient();

    const requestInterceptor = (
      client.instance.interceptors.request as unknown as {
        handlers: Array<{
          fulfilled: (c: unknown) => { headers: Record<string, string> };
        }>;
      }
    ).handlers[0];
    const config = requestInterceptor.fulfilled({
      method: "get",
      headers: {} as Record<string, string>,
    });

    expect(config.headers["X-CSRF-Token"]).toBeUndefined();
  });
});
