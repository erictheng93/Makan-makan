import { describe, expect, it, vi } from "vitest";
import {
  isTestDatabaseReuseEnabled,
  withDiagnosticTimeout,
} from "./create-test-database";

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

describe("withDiagnosticTimeout", () => {
  it("returns the operation result before the deadline", async () => {
    await expect(
      withDiagnosticTimeout(Promise.resolve("ready"), 60_000, "startup"),
    ).resolves.toBe("ready");
  });

  it("rejects with an operation-specific message after the deadline", async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<never>(() => {});
      const result = withDiagnosticTimeout(
        pending,
        60_000,
        "starting Miniflare D1",
      );
      const rejection = expect(result).rejects.toThrow(
        "Timed out starting Miniflare D1 after 60s",
      );

      await vi.advanceTimersByTimeAsync(60_000);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
