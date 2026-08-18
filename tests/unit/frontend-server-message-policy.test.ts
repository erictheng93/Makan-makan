import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * #198: the server answers in English, so anything it writes is for a log and
 * not for a shop. Views resolve their copy from the response's status and code
 * instead (`resolveUserFacingError`). This inventory is the exception list --
 * every remaining read of a server-supplied message, with the reason it is
 * still there, so "we will finish the migration later" fails the build rather
 * than fading out of memory.
 */
const repoRoot = process.cwd();
const apps = ["admin-dashboard", "kitchen-display", "customer-app"];
const policyPath = join(
  repoRoot,
  "docs/architecture/frontend/server-message-presentation-policy.json",
);

// The four message-reading helpers were deleted; `describeErrorForLog` is what
// replaced them, and its whole job is to read what must not be rendered. So the
// inventory follows the name: every call is a promise that nothing shows it.
const helpers = ["describeErrorForLog"];
const allowedCategories = new Set([
  // A browser-side throwable, not a server response.
  "local-error",
  // Carried on a service envelope for logging; no view renders it.
  "transport-envelope",
  // Stored on a queued offline action for retry bookkeeping.
  "queued-action-record",
  // Wrapped into an Error for the error-report pipeline.
  "error-report",
]);
const allowedPlans = new Set(["retain", "migrate"]);

const callPattern = new RegExp(`(?<![.\\w])(${helpers.join("|")})\\s*\\(`);
const definitionPattern = new RegExp(
  `\\b(function|const|let|private|public|protected)\\s+(${helpers.join("|")})\\b`,
);

interface CallSite {
  app: string;
  file: string;
  helper: string;
  occurrence: number;
  code: string;
}

interface PolicyEntry extends CallSite {
  category: string;
  plan: string;
  rationale: string;
}

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);

    if (statSync(absolutePath).isDirectory()) {
      files.push(...listSourceFiles(absolutePath));
      continue;
    }

    const isSource =
      absolutePath.endsWith(".ts") || absolutePath.endsWith(".vue");
    if (isSource && !absolutePath.includes(".test.")) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

function discoverCallSites(): CallSite[] {
  const sites: CallSite[] = [];

  for (const app of apps) {
    const counts = new Map<string, number>();

    for (const absolutePath of listSourceFiles(
      join(repoRoot, `apps/${app}/src`),
    )) {
      // POSIX paths so the inventory reads the same on Windows.
      const file = relative(repoRoot, absolutePath).replace(/\\/g, "/");
      // The helper module itself, where these are defined and composed.
      if (file.endsWith("/utils/unknown.ts")) continue;

      for (const line of readFileSync(absolutePath, "utf8").split("\n")) {
        const match = callPattern.exec(line);
        if (!match) continue;

        const code = line.trim();
        if (
          code.startsWith("import") ||
          line.includes('from "') ||
          definitionPattern.test(line)
        ) {
          continue;
        }

        const helper = match[1];
        const key = `${file}#${helper}`;
        const occurrence = (counts.get(key) ?? 0) + 1;
        counts.set(key, occurrence);
        sites.push({ app, file, helper, occurrence, code });
      }
    }
  }

  return sites;
}

/**
 * Keyed on the nth call of a helper within a file rather than on a line number:
 * editing anything above a site would otherwise turn the guard red for a change
 * that did not touch it, and a guard that cries wolf gets deleted.
 */
function keyOf(site: Pick<CallSite, "file" | "helper" | "occurrence">) {
  return `${site.file}#${site.helper}#${site.occurrence}`;
}

describe("frontend server-message presentation policy", () => {
  it("requires every remaining read of a server message to be inventoried", () => {
    expect(existsSync(policyPath)).toBe(true);

    const discovered = discoverCallSites();
    const policy = JSON.parse(
      readFileSync(policyPath, "utf8"),
    ) as PolicyEntry[];
    const policyByKey = new Map(policy.map((entry) => [keyOf(entry), entry]));
    const discoveredByKey = new Map(
      discovered.map((site) => [keyOf(site), site]),
    );

    const missing = discovered
      .filter((site) => !policyByKey.has(keyOf(site)))
      .map(keyOf);
    const stale = policy
      .filter((entry) => !discoveredByKey.has(keyOf(entry)))
      .map(keyOf);

    expect({ missing, stale }).toEqual({ missing: [], stale: [] });

    for (const site of discovered) {
      const entry = policyByKey.get(keyOf(site));
      expect(entry, keyOf(site)).toBeDefined();
      expect(entry?.code, keyOf(site)).toBe(site.code);
      expect(entry?.app, keyOf(site)).toBe(site.app);
      expect(allowedCategories.has(entry?.category ?? ""), keyOf(site)).toBe(
        true,
      );
      expect(allowedPlans.has(entry?.plan ?? ""), keyOf(site)).toBe(true);
      expect(entry?.rationale.trim().length, keyOf(site)).toBeGreaterThan(40);
    }
  });

  /**
   * The migration's own result, asserted rather than remembered. These are the
   * layers it emptied; a regression there is what this file exists to catch.
   */
  it("keeps the migrated layers free of server messages", () => {
    const migrated = discoverCallSites().filter(
      (site) =>
        site.file.includes("/stores/") ||
        site.file.includes("/views/seating/") ||
        site.file.includes("/views/employees/") ||
        site.file.includes("/composables/useFeedback"),
    );

    expect(migrated.map(keyOf)).toEqual([]);
  });
});
