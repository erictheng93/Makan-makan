// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Production keeps the access token in memory, so a reload starts
 * unauthenticated and the session comes back only once `restoreSession()` has
 * spent the refresh cookie. Installing the router starts its initial navigation
 * straight away, so installing it before that await let the guard judge
 * `isAuthenticated` mid-flight: it bounced to /login at ~150ms, the refresh
 * landed at ~1300ms, and LoginView then sent the now-authenticated user to
 * their role's default page instead of the one they reloaded.
 *
 * The ordering is the fix, and two reordered lines would silently undo it.
 */

const events: string[] = [];

const ROUTER = { __marker: "router" };

vi.mock("./router", () => ({ router: ROUTER }));
vi.mock("./App.vue", () => ({ default: {} }));
vi.mock("@/components/ErrorDisplay.vue", () => ({ default: {} }));
vi.mock("vue-toastification", () => ({ default: { __marker: "toast" } }));
vi.mock("vue-toastification/dist/index.css", () => ({}));
vi.mock("./assets/css/main.css", () => ({}));

vi.mock("./i18n", () => ({
  initI18n: vi.fn(async () => void events.push("i18n")),
}));

vi.mock("@/utils/errorHandler", () => ({
  setupGlobalErrorHandler: vi.fn(),
  errorHandler: { handleError: vi.fn() },
}));

vi.mock("@makanmasak/shared/stores/moduleAccess", () => ({
  configureModuleAccess: vi.fn(() => void events.push("configureModuleAccess")),
  useModuleAccessStore: () => ({ fetch: vi.fn(async () => {}) }),
}));

vi.mock("@/services/api", () => ({
  resolveApiBase: () => "https://api.makanmasak.com/api/v1",
}));

vi.mock("@/utils/authTokenProvider", () => ({
  getAuthToken: () => "token-abc",
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    // Resolve across several microtasks, the way a real network round trip
    // would — a synchronous stub would hide the race entirely.
    restoreSession: vi.fn(async () => {
      events.push("restore:start");
      for (let i = 0; i < 5; i++) await Promise.resolve();
      events.push("restore:end");
      return true;
    }),
    get isAuthenticated() {
      return true;
    },
  }),
}));

vi.mock("vue", () => ({
  createApp: () => ({
    use: (plugin: unknown) => {
      events.push(plugin === ROUTER ? "use:router" : "use:other");
    },
    component: vi.fn(),
    mount: () => void events.push("mount"),
    config: {},
  }),
}));

vi.mock("pinia", () => ({ createPinia: () => ({ __marker: "pinia" }) }));

describe("admin dashboard bootstrap", () => {
  beforeEach(() => {
    events.length = 0;
    vi.resetModules();
  });

  it("installs the router only after the session is restored", async () => {
    await import("./main");
    // bootstrap() is fired at import time and is not awaited by the module.
    await vi.waitFor(() => expect(events).toContain("mount"));

    expect(events.indexOf("use:router")).toBeGreaterThan(
      events.indexOf("restore:end"),
    );
  });

  it("mounts only after the router is installed", async () => {
    await import("./main");
    await vi.waitFor(() => expect(events).toContain("mount"));

    expect(events.indexOf("mount")).toBeGreaterThan(
      events.indexOf("use:router"),
    );
  });
});
