import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
};

describe("orders PK package scripts", () => {
  it("does not expose legacy destructive PK rehearsal aliases", () => {
    expect(packageJson.scripts).not.toHaveProperty("db:orders-pk-dry-run");
    expect(packageJson.scripts).not.toHaveProperty(
      "db:orders-pk-dry-run:fixture",
    );
    expect(packageJson.scripts).not.toHaveProperty(
      "db:orders-pk-dry-run:representative",
    );
    expect(packageJson.scripts).not.toHaveProperty(
      "db:orders-pk-dry-run:fixture-full-surface",
    );
    expect(packageJson.scripts).not.toHaveProperty("db:users-pk-dry-run");
    expect(packageJson.scripts).not.toHaveProperty(
      "db:users-pk-dry-run:representative",
    );
    expect(packageJson.scripts).not.toHaveProperty("db:pk-rehearsal:validate");
    expect(packageJson.scripts).not.toHaveProperty(
      "db:orders-pk-readiness:verify",
    );
  });
});
