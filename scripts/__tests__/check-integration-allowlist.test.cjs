const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "../check-integration-allowlist.cjs");

function runInTempRepo(files, allowlist) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-test-"));
  fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "tests/.integration-allowlist.json"),
    JSON.stringify(allowlist, null, 2),
  );
  for (const f of files) {
    const full = path.join(tmpDir, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "// dummy test");
  }
  try {
    execFileSync("node", [SCRIPT], { cwd: tmpDir });
    return { status: 0 };
  } catch (err) {
    return {
      status: err.status,
      stderr: err.stderr?.toString() ?? "",
      stdout: err.stdout?.toString() ?? "",
    };
  }
}

test("passes when all files are in the allowlist", () => {
  const result = runInTempRepo(
    ["apps/api/src/features/foo/__tests__/integration.test.ts"],
    {
      real_auto_allowed_pattern:
        "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [
        "apps/api/src/features/foo/__tests__/integration.test.ts",
      ],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.strictEqual(result.status, 0);
});

test("passes when file matches the real auto-allowed pattern", () => {
  const result = runInTempRepo(
    ["apps/api/src/__tests__/integration/orders.real.integration.test.ts"],
    {
      real_auto_allowed_pattern:
        "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.strictEqual(result.status, 0);
});

test("fails when an unknown file is added", () => {
  const result = runInTempRepo(
    ["apps/new-app/src/__tests__/rogue-integration.test.ts"],
    {
      real_auto_allowed_pattern:
        "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /rogue-integration\.test\.ts/);
});
