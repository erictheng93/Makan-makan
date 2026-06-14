import { describe, expect, it } from "vitest";
import { isTestDatabaseReuseEnabled } from "./create-test-database";

describe("isTestDatabaseReuseEnabled", () => {
  it("uses migrated baseline reuse by default", () => {
    expect(isTestDatabaseReuseEnabled({})).toBe(true);
  });

  it("allows explicit opt-out for migration timing diagnostics", () => {
    expect(
      isTestDatabaseReuseEnabled({ MAKANMAKAN_REAL_D1_REUSE_DB: "0" }),
    ).toBe(false);
  });

  it("keeps the existing explicit opt-in value enabled", () => {
    expect(
      isTestDatabaseReuseEnabled({ MAKANMAKAN_REAL_D1_REUSE_DB: "1" }),
    ).toBe(true);
  });
});
