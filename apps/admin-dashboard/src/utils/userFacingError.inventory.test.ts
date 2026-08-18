import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.(ts|vue)$/.test(entry.name)
        ? [file]
        : [];
  });
}

describe("admin user-facing API errors", () => {
  it("does not use the raw API envelope message helper in UI source", () => {
    const sourceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const offenders = sourceFiles(sourceRoot)
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) =>
        fs.readFileSync(file, "utf8").includes("getApiEnvelopeMessage"),
      )
      .map((file) => path.relative(sourceRoot, file));

    expect(offenders).toEqual([]);
  });
});
