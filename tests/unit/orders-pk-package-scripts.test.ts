import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
};

describe("orders PK package scripts", () => {
  it("keeps real representative and synthetic fixture rehearsals distinct", () => {
    expect(packageJson.scripts["db:orders-pk-dry-run:representative"]).toBe(
      "node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --require-representative-data --require-complete-surface-coverage",
    );
    expect(
      packageJson.scripts["db:orders-pk-dry-run:representative"],
    ).not.toContain("--with-fixture");

    expect(
      packageJson.scripts["db:orders-pk-dry-run:fixture-full-surface"],
    ).toBe(
      "node scripts/phase-c-orders-pk-dry-run.cjs --execute-local --with-fixture --require-representative-data --require-complete-surface-coverage",
    );
  });
});
