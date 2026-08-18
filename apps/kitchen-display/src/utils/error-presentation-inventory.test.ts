import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("kitchen user-facing error inventory", () => {
  it("routes UI error helpers through the locale-safe resolver", () => {
    const unknownUtility = fs.readFileSync(
      path.join(sourceRoot, "utils/unknown.ts"),
      "utf8",
    );

    expect(unknownUtility).toContain("resolveUserFacingError");
    expect(unknownUtility).not.toMatch(/(?:error|data)\.message/);
  });
});
