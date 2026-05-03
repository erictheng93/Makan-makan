import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appFactorySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app-factory.ts"),
  "utf8",
);

const protectedPrefixes: Array<[string, string]> = [
  ["/pos/*", "pos"],
  ["/payments/*", "online_ordering"],
  ["/leaves/*", "staff_management"],
  ["/scheduling/*", "staff_management"],
  ["/forecast/*", "analytics"],
  ["/ingredients/*", "inventory"],
  ["/feedback/*", "analytics"],
];

function middlewareCall(prefix: string, middleware: string): RegExp {
  return new RegExp(
    `apiV1\\.use\\(\\s*["']${prefix.replace(/\*/g, "\\*")}["']\\s*,\\s*${middleware}`,
  );
}

describe("P1-d module gate coverage", () => {
  it.each(protectedPrefixes)(
    "protects %s with auth and moduleGate(%s)",
    (prefix, module) => {
      expect(appFactorySource).toMatch(
        middlewareCall(prefix, "authMiddleware"),
      );
      expect(appFactorySource).toMatch(
        middlewareCall(prefix, `moduleGate\\(\\s*["']${module}["']\\s*\\)`),
      );
    },
  );

  it("keeps queue routes out of moduleGate until the queue metering spec lands", () => {
    expect(appFactorySource).not.toMatch(
      /apiV1\.use\(\s*["']\/queue\/\*["']\s*,\s*moduleGate/,
    );
  });
});
