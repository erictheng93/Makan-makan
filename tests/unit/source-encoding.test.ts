import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// U+FFFD is what a decoder emits when it cannot decode a byte sequence, so its
// presence in source means the original characters are already gone -- by the
// time it lands in a file the damage is unrecoverable, not merely ugly. C0
// control characters travel with it: BaseChart.vue and useDateFormatter.ts both
// carried stray NUL/BS/SI bytes where CJK text used to be, and the NULs made git
// classify a .vue component as binary so it could no longer be diffed or merged.
// Written as escapes on purpose: a literal class here would make this file
// the first thing its own assertion trips over.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\uFFFD\x00-\x08\x0B-\x1F]/;

const TEXT_EXTENSIONS = /\.(ts|tsx|js|cjs|mjs|vue|json|md|toml|css|html|sql)$/;

function trackedTextFiles(): string[] {
  // Ask git rather than walking the tree: it already knows about .gitignore,
  // node_modules, dist output and nested worktrees, none of which are ours.
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  return output
    .split("\0")
    .filter((file) => file.length > 0 && TEXT_EXTENSIONS.test(file));
}

describe("source encoding", () => {
  it("keeps tracked source free of replacement and control characters", () => {
    const damaged = trackedTextFiles().filter((file) => {
      const contents = readFileSync(resolve(repoRoot, file), "utf8");
      return FORBIDDEN.test(contents);
    });

    expect(damaged).toEqual([]);
  });
});
