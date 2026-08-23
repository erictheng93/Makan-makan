import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { checkNoAutomatedDestructiveWrangler } =
  require("../../scripts/check-no-automated-destructive-wrangler.cjs") as {
    checkNoAutomatedDestructiveWrangler: (options?: { root?: string }) => {
      violations: Array<{ file: string; location: string; command: string }>;
    };
  };

const roots: string[] = [];

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "d1-guard-"));
  roots.push(root);

  for (const [relative, content] of Object.entries(files)) {
    const full = join(root, relative);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }

  return root;
}

afterEach(() => {
  while (roots.length) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("check-no-automated-destructive-wrangler", () => {
  it("passes on the real repository", () => {
    expect(checkNoAutomatedDestructiveWrangler().violations).toEqual([]);
  });

  it("catches a restore in a workflow", () => {
    const root = fixture({
      ".github/workflows/deploy.yml":
        "jobs:\n  x:\n    steps:\n      - run: wrangler d1 time-travel restore makanmasak-prod --bookmark=abc\n",
    });

    const { violations } = checkNoAutomatedDestructiveWrangler({ root });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: ".github/workflows/deploy.yml",
      command: "wrangler d1 time-travel restore",
    });
  });

  // A YAML block scalar can wrap the command across lines, which a per-line
  // scan would miss entirely.
  it("catches a restore split across lines", () => {
    const root = fixture({
      ".github/workflows/dr.yml":
        "      - run: |\n          wrangler d1 time-travel\n            restore makanmasak-prod\n",
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([{ command: "wrangler d1 time-travel restore" }]);
  });

  it("catches a restore hidden in a package script", () => {
    const root = fixture({
      "package.json": JSON.stringify({
        scripts: { "dr:rollback": "wrangler d1 time-travel restore my-db" },
      }),
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([
      { file: "package.json", location: "scripts.dr:rollback" },
    ]);
  });

  it("catches a restore in a workspace package script", () => {
    const root = fixture({
      "apps/api/package.json": JSON.stringify({
        scripts: { reset: "pnpm wrangler d1 delete makanmasak-prod" },
      }),
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([
      { file: "apps/api/package.json", command: "wrangler d1 delete" },
    ]);
  });

  it("catches a restore in a git hook", () => {
    const root = fixture({
      ".husky/pre-push": "#!/bin/sh\nwrangler d1 delete scratch-db\n",
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([
      { file: ".husky/pre-push", command: "wrangler d1 delete" },
    ]);
  });

  it("reports each command once per file rather than once per pass", () => {
    const root = fixture({
      "scripts/dr.sh":
        "wrangler d1 time-travel restore a\nwrangler d1 time-travel restore b\n",
    });

    // Both the line scan and the whole-file scan see this; the report must not
    // triple-count it.
    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toHaveLength(1);
  });

  it("leaves non-destructive d1 commands alone", () => {
    const root = fixture({
      "scripts/ok.sh": [
        "wrangler d1 execute makanmasak-prod --command 'SELECT 1'",
        "wrangler d1 time-travel info makanmasak-prod",
        "wrangler d1 migrations apply makanmasak-prod",
        "wrangler d1 list",
        "wrangler d1 delete-nothing-like-this",
      ].join("\n"),
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });

  // The runbook has to be able to show the command it documents.
  it("does not scan docs", () => {
    const root = fixture({
      "docs/runbooks/backup-restore-runbook.md":
        "```bash\nwrangler d1 time-travel restore makanmasak-prod --bookmark=x\n```\n",
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });

  // A gate that fires on its own rationale is a gate people switch off, and
  // the ban site is exactly where the explanation belongs.
  it("ignores comments naming the commands", () => {
    const root = fixture({
      ".husky/pre-commit":
        "#!/bin/sh\n# never put wrangler d1 time-travel restore in automation\n# nor wrangler d1 delete\npnpm lint-staged\n",
      ".github/workflows/ci.yml":
        "# wrangler d1 delete auto-confirms in CI\njobs: {}\n",
      "scripts/notes.cjs":
        "/**\n * Do not call wrangler d1 time-travel restore from here.\n */\n// nor wrangler d1 delete\nmodule.exports = {};\n",
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });

  it("still catches a real command in a file that also comments about it", () => {
    const root = fixture({
      "scripts/dr.sh":
        "# wrangler d1 time-travel restore is dangerous, which is why we...\nwrangler d1 time-travel restore makanmasak-prod --bookmark=x\n",
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([{ file: "scripts/dr.sh", location: "line 2" }]);
  });

  // Dropping comment lines shortens the text the whole-file pass sees, so it
  // could in principle staple unrelated lines into a match. Real executable
  // text between them still has to keep them apart.
  it("does not invent a match by closing a comment gap", () => {
    const root = fixture({
      "scripts/split.sh":
        "echo wrangler d1 time-travel\n# a comment in between\necho restore\n",
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });

  it("does not flag a dependency that merely contains the name", () => {
    const root = fixture({
      "package.json": JSON.stringify({
        scripts: { build: "tsc" },
        devDependencies: { "d1-delete-helper": "^1.0.0" },
      }),
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });

  // Deleting a Worker auto-confirms exactly like the D1 commands do -- seen
  // while decommissioning makanmasak-backup-scheduler-prod.
  it("catches a worker deletion", () => {
    const root = fixture({
      ".github/workflows/teardown.yml":
        "      - run: pnpm exec wrangler delete --name makanmasak-api-prod\n",
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([
      { file: ".github/workflows/teardown.yml", command: "wrangler delete" },
    ]);
  });

  it("catches a worker deletion after Wrangler global options", () => {
    const root = fixture({
      ".github/workflows/teardown.yml":
        "      - run: wrangler --config=apps/api/wrangler.toml delete --name makanmasak-api-prod\n",
    });

    expect(
      checkNoAutomatedDestructiveWrangler({ root }).violations,
    ).toMatchObject([
      { file: ".github/workflows/teardown.yml", command: "wrangler delete" },
    ]);
  });

  // The two must not be confused: "wrangler d1 delete" is the D1 entry, and a
  // report naming the wrong command sends the reader to the wrong runbook.
  it("reports a D1 deletion as D1, not as a worker deletion", () => {
    const root = fixture({
      "scripts/reset.sh": "pnpm wrangler d1 delete scratch-db\n",
    });

    const { violations } = checkNoAutomatedDestructiveWrangler({ root });
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe("wrangler d1 delete");
  });

  it("leaves non-destructive wrangler commands alone", () => {
    const root = fixture({
      "scripts/deploy.sh": [
        "wrangler deploy --env production",
        "wrangler pages deploy dist --project-name=x",
        "wrangler deployments list --name y",
        "wrangler delete-nothing",
      ].join("\n"),
    });

    expect(checkNoAutomatedDestructiveWrangler({ root }).violations).toEqual(
      [],
    );
  });
});
