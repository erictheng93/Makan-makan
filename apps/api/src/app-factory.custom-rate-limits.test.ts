import { beforeAll, describe, expect, it, vi } from "vitest";

const meterEmit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./shared/utils/meter", () => ({ meterEmit }));

import { API_CUSTOM_RATE_LIMITS, createApp } from "./app-factory";

/**
 * #339: every `customLimits` key was compared against the full request path
 * with `===`, so three keys naming a mount prefix that has no route of its own
 * (`/api/v1/admin`, `/api/v1/system`, `/api/v1/integrations/webhooks`) matched
 * nothing and quietly did nothing for as long as they had been there. Nothing
 * in the type system or the runtime says so — the config just reads plausible.
 *
 * This is that missing signal: an `exact` key has to name a route the app
 * actually registers.
 */
describe("API_CUSTOM_RATE_LIMITS", () => {
  let registeredPaths: Set<string>;

  // createApp pulls in every feature router. Pay that transform cost once here
  // under the hook's own budget rather than against a test timeout (#211).
  beforeAll(() => {
    const app = createApp(undefined, {
      disableEdgeCache: true,
      disableObservability: true,
    });
    registeredPaths = new Set(app.routes.map((route) => route.path));
    // Guard the guard: if Hono ever stops flattening mounted sub-routers into
    // `app.routes`, every assertion below would pass vacuously.
    expect(registeredPaths.has("/api/v1/orders")).toBe(true);
  }, 30_000);

  const entries = Object.entries(API_CUSTOM_RATE_LIMITS) as Array<
    [string, { match?: "exact" | "prefix" }]
  >;

  it.each(entries.filter(([, limit]) => limit.match !== "prefix"))(
    "exact entry %s names a registered route",
    (path) => {
      expect(registeredPaths.has(path)).toBe(true);
    },
  );

  it.each(entries.filter(([, limit]) => limit.match === "prefix"))(
    "prefix entry %s covers at least one registered route",
    (prefix) => {
      const covered = [...registeredPaths].filter((path) =>
        path.startsWith(`${prefix}/`),
      );
      expect(covered.length).toBeGreaterThan(0);
    },
  );

  // Health endpoints are polled by dashboards and alerting. `skipPaths` keeps
  // them out of the limiter entirely, but a prefix entry covering them would
  // still be a mistake waiting for someone to widen `skipPaths`.
  it("has no entry that would capture a health endpoint", () => {
    const healthPaths = [...registeredPaths].filter((path) =>
      path.includes("/health"),
    );
    expect(healthPaths.length).toBeGreaterThan(0);

    for (const [key, limit] of entries) {
      for (const healthPath of healthPaths) {
        const captured =
          key === healthPath ||
          (limit.match === "prefix" && healthPath.startsWith(`${key}/`));
        expect(captured, `${key} captures ${healthPath}`).toBe(false);
      }
    }
  });
});
