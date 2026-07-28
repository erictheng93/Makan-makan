import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedApiClient } from "./create-api-client";
import type { ApiClient } from "./types";

// #66: the CSRF token used to live only in a module variable, so a page reload
// wiped it and the next state-changing request went out with no token. The
// cookie fallback cannot cover that — the API sets a `__Host-` prefixed cookie,
// which is host-only on the API origin, and every front-end is served from a
// different subdomain, so document.cookie never sees it.

const LEGACY_KEY = "mm_csrf_token";
const keyFor = (prefix: string) => `mm_csrf_token_${prefix}`;

const TOKEN = "a".repeat(64);
const OTHER_TOKEN = "b".repeat(64);

function installStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  const adapter = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  vi.stubGlobal("localStorage", adapter);
  // clearAll() sweeps both scopes; a session-scoped stub keeps it off the real
  // global. Both back the same map — these tests only care that keys vanish.
  vi.stubGlobal("sessionStorage", adapter);
  return values;
}

function buildClient(storageKeyPrefix = "auth") {
  return createAuthenticatedApiClient({
    baseURL: "https://api.test/api/v1",
    storageKeyPrefix,
    csrf: true,
  });
}

/** Drive the response interceptor as if the API had answered with a token. */
function receiveCsrfToken(client: ApiClient, token: string) {
  const handler = (
    client.instance.interceptors.response as unknown as {
      handlers: Array<{ fulfilled: (r: unknown) => unknown }>;
    }
  ).handlers[0];
  handler.fulfilled({ headers: { "x-csrf-token": token } });
}

/** Drive the request interceptor and return the headers it produced. */
function outgoingHeaders(client: ApiClient, method: string) {
  const handler = (
    client.instance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (c: unknown) => { headers: Record<string, string> };
      }>;
    }
  ).handlers[0];
  return handler.fulfilled({ method, headers: {} as Record<string, string> })
    .headers;
}

describe("auth client CSRF token persistence", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("document", { cookie: "" });
  });

  it("persists a token received on a response header", () => {
    const values = installStorage();

    receiveCsrfToken(buildClient(), TOKEN);

    expect(values.get(keyFor("auth"))).toBe(TOKEN);
  });

  it("sends a token that a previous page load stored", () => {
    installStorage({ [keyFor("auth")]: TOKEN, auth_auth_token: "bearer" });

    // Nothing was cached in memory this page load — without persistence the
    // header would be absent and the request would 403.
    expect(outgoingHeaders(buildClient(), "post")["X-CSRF-Token"]).toBe(TOKEN);
  });

  it("does not attach a token to safe methods", () => {
    installStorage({ [keyFor("auth")]: TOKEN });

    expect(
      outgoingHeaders(buildClient(), "get")["X-CSRF-Token"],
    ).toBeUndefined();
  });
});

describe("auth client CSRF token namespacing", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("document", { cookie: "" });
  });

  // Each API host sets its own host-only __Host-mm_csrf cookie, so one shared
  // storage key meant the management client's token could be echoed back to the
  // main API, whose cookie holds a different value — an unavoidable 403.
  it("keeps each client's token separate", () => {
    const values = installStorage();

    receiveCsrfToken(buildClient("auth"), TOKEN);
    receiveCsrfToken(buildClient("management_auth"), OTHER_TOKEN);

    expect(values.get(keyFor("auth"))).toBe(TOKEN);
    expect(values.get(keyFor("management_auth"))).toBe(OTHER_TOKEN);
  });

  it("does not let one client's rotation change what another sends", () => {
    installStorage();

    const api = buildClient("auth");
    receiveCsrfToken(api, TOKEN);
    receiveCsrfToken(buildClient("management_auth"), OTHER_TOKEN);

    expect(outgoingHeaders(api, "post")["X-CSRF-Token"]).toBe(TOKEN);
  });

  it("adopts a token stored under the pre-namespace key", () => {
    // Sessions already open when this ships have only the shared key. Ignoring
    // it would send them into a CSRF-protected /auth/refresh with no token.
    installStorage({ [LEGACY_KEY]: TOKEN });

    expect(outgoingHeaders(buildClient(), "post")["X-CSRF-Token"]).toBe(TOKEN);
  });

  it("retires the shared key once a token rotates", () => {
    const values = installStorage({ [LEGACY_KEY]: TOKEN });

    receiveCsrfToken(buildClient(), OTHER_TOKEN);

    expect(values.has(LEGACY_KEY)).toBe(false);
    expect(values.get(keyFor("auth"))).toBe(OTHER_TOKEN);
  });
});

describe("auth client CSRF token lifecycle", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("document", { cookie: "" });
  });

  // The token belongs to the session. Leaving it behind on logout meant the
  // next login's first write echoed a token the server had rotated away from.
  it("drops the stored token when the session is cleared", () => {
    const values = installStorage();
    const client = buildClient();
    receiveCsrfToken(client, TOKEN);

    client.tokens.clearAll();

    expect(values.has(keyFor("auth"))).toBe(false);
    expect(outgoingHeaders(client, "post")["X-CSRF-Token"]).toBeUndefined();
  });
});
