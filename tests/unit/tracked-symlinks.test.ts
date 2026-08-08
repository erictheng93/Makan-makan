import { execFileSync } from "node:child_process";
import { isAbsolute } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

// A symlink committed with an absolute target only resolves on the machine that
// created it. `.claude/skills/*/SKILL.md` were checked in pointing at
// /Users/<someone>/.../Makan-makan/..., so they dangled on every CI runner and
// every fresh clone -- and source-encoding.test.ts, which reads every tracked
// text file, died on ENOENT and kept main red for days. It went unnoticed
// locally precisely because the absolute target does exist there.
function trackedSymlinks(): Array<{ path: string; target: string }> {
  // `git ls-files -s` reports mode 120000 for symlinks; read the target from
  // the index blob rather than the filesystem so the check still holds on a
  // machine where the link happens to resolve.
  const output = execFileSync("git", ["ls-files", "-s", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  return output
    .split("\0")
    .filter((entry) => entry.startsWith("120000 "))
    .map((entry) => {
      const [meta, path] = entry.split("\t");
      const objectId = meta.split(" ")[1];
      const target = execFileSync("git", ["cat-file", "-p", objectId], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      return { path, target };
    });
}

describe("tracked symlinks", () => {
  it("keeps every committed symlink target relative", () => {
    const absolute = trackedSymlinks()
      .filter(({ target }) => isAbsolute(target))
      .map(({ path, target }) => `${path} -> ${target}`);

    expect(absolute).toEqual([]);
  });
});
