import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../shared/utils/api-error";

let _mockDbRows: any[] = [];
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(_mockDbRows)),
        }),
      }),
    }),
  })),
}));

import { moduleGate } from "../middleware/moduleGate";
import type { ModuleKey } from "@makanmakan/database";

const appFactorySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app-factory.ts"),
  "utf8",
);

const protectedPrefixes: Array<[string, ModuleKey, string]> = [
  ["/menu/*", "menu_management", "features/menu/routes/index.ts"],
  ["/kitchen/*", "kitchen_display", "features/kitchen/routes/index.ts"],
  [
    "/orders/group/*",
    "online_ordering",
    "features/group-orders/routes/index.ts",
  ],
  ["/orders/*", "online_ordering", "features/orders/routes/index.ts"],
  ["/pos/*", "pos", "app-factory.ts"],
  ["/payments/*", "online_ordering", "app-factory.ts"],
  ["/tables/*", "table_management", "features/tables/routes/index.ts"],
  ["/seats/*", "table_management", "features/seats/routes/index.ts"],
  ["/analytics/*", "analytics", "features/analytics/routes/index.ts"],
  ["/ai-analytics/*", "ai_analytics", "features/ai-analytics/routes/index.ts"],
  ["/coupons/*", "coupons", "features/coupons/routes/index.ts"],
  ["/reservations/*", "reservations", "features/reservations/routes/index.ts"],
  ["/waiting-list/*", "reservations", "features/waiting-list/routes/index.ts"],
  ["/partnerships/*", "loyalty", "features/partnerships/routes/index.ts"],
  [
    "/integrations/*",
    "platform_integration",
    "features/integrations/routes/admin.ts",
  ],
  ["/leaves/*", "staff_management", "app-factory.ts"],
  ["/scheduling/*", "staff_management", "app-factory.ts"],
  ["/forecast/*", "analytics", "app-factory.ts"],
  ["/ingredients/*", "inventory", "app-factory.ts"],
  ["/feedback/*", "analytics", "app-factory.ts"],
];

function sourceFor(path: string): string {
  if (path === "app-factory.ts") return appFactorySource;
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../", path),
    "utf8",
  );
}

function middlewareCall(prefix: string, middleware: string): RegExp {
  return new RegExp(
    `apiV1\\.use\\(\\s*["']${prefix.replace(/\*/g, "\\*")}["']\\s*,\\s*${middleware}`,
  );
}

describe("P1-d module gate coverage — static wiring", () => {
  it.each(protectedPrefixes)(
    "%s wires moduleGate(%s) at the source location",
    (prefix, module, path) => {
      const source = sourceFor(path);
      if (path === "app-factory.ts") {
        expect(appFactorySource).toMatch(
          middlewareCall(prefix, "authMiddleware"),
        );
      }
      expect(source).toMatch(
        new RegExp(`moduleGate\\(\\s*["']${module}["']\\s*\\)`),
      );
    },
  );

  it("keeps queue routes out of moduleGate until the queue metering spec lands", () => {
    expect(appFactorySource).not.toMatch(
      /apiV1\.use\(\s*["']\/queue\/\*["']\s*,\s*moduleGate/,
    );
  });
});

describe("P1-d module gate coverage — runtime 403", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockDbRows = [];
  });

  function buildGateApp(prefix: string, module: ModuleKey) {
    const trimmedPrefix = prefix.replace(/\*$/, "").replace(/\/$/, "");
    const probePath = `${trimmedPrefix}/__probe`;

    const app = new Hono<any>();

    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: { code: err.code, message: err.message },
          },
          err.status as never,
        );
      }
      return c.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: err.message },
        },
        500,
      );
    });

    const cachedBasic = {
      isActive: true,
      planTier: "basic" as const,
      moduleOverrides: {},
      trialEndsAt: null,
      deploymentMode: "managed" as const,
    };

    const kvGet = vi.fn().mockResolvedValue(cachedBasic);
    const kvPut = vi.fn().mockResolvedValue(undefined);

    app.use("*", async (c, next) => {
      (c as any).env = {
        DB: {},
        CACHE_KV: { get: kvGet, put: kvPut, delete: vi.fn() },
      };
      c.set("user", {
        id: 1,
        username: "shop-owner",
        role: 1,
        restaurantId: "rest-basic-1",
      });
      await next();
    });

    app.use(prefix, moduleGate(module));
    app.get(probePath, (c) => c.json({ success: true }));

    return { app, probePath, kvGet };
  }

  it.each(protectedPrefixes)(
    "%s returns 403 MODULE_NOT_ENABLED for a basic-plan tenant when module=%s is not granted",
    async (prefix, module) => {
      // basic plan only includes menu_management, table_management, online_ordering;
      // any other required module → MODULE_NOT_ENABLED
      const basicAllows = new Set<ModuleKey>([
        "menu_management",
        "table_management",
        "online_ordering",
      ]);
      const { app, probePath, kvGet } = buildGateApp(prefix, module);
      const res = await app.request(`http://localhost${probePath}`);
      const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };

      if (basicAllows.has(module)) {
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(403);
        expect(body.error.code).toBe("MODULE_NOT_ENABLED");
      }
      expect(kvGet).toHaveBeenCalledWith("subscription:rest-basic-1", "json");
    },
  );

  it("returns 403 MODULE_NOT_ENABLED for an enterprise tenant when isActive=false (kill switch)", async () => {
    const { app, probePath, kvGet } = buildGateApp(
      "/kitchen/*",
      "kitchen_display",
    );
    kvGet.mockResolvedValueOnce({
      isActive: false,
      planTier: "enterprise",
      moduleOverrides: {},
      trialEndsAt: null,
      deploymentMode: "managed",
    });

    const res = await app.request(`http://localhost${probePath}`);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("MODULE_NOT_ENABLED");
  });

  it("returns 403 TRIAL_EXPIRED for trial tenant after trialEndsAt", async () => {
    const { app, probePath, kvGet } = buildGateApp(
      "/kitchen/*",
      "kitchen_display",
    );
    kvGet.mockResolvedValueOnce({
      isActive: true,
      planTier: "trial",
      moduleOverrides: {},
      trialEndsAt: Date.now() - 1_000,
      deploymentMode: "managed",
    });

    const res = await app.request(`http://localhost${probePath}`);
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("TRIAL_EXPIRED");
  });
});
