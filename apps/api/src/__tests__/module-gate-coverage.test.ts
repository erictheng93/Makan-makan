import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appFactorySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app-factory.ts"),
  "utf8",
);

const protectedPrefixes: Array<[string, string, string]> = [
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

describe("P1-d module gate coverage", () => {
  it.each(protectedPrefixes)(
    "protects %s with auth and moduleGate(%s)",
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
