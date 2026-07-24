import { describe, expect, it } from "vitest";
import {
  compareVersions,
  maxVersion,
  parseVersion,
  sortVersionsAscending,
  sortVersionsDescending,
} from "./semver";

describe("semver", () => {
  it("parses a strict MAJOR.MINOR.PATCH string", () => {
    expect(parseVersion("1.10.0")).toEqual([1, 10, 0]);
    expect(parseVersion("2.0.3")).toEqual([2, 0, 3]);
  });

  it("degrades non-conforming / missing input to [0,0,0]", () => {
    expect(parseVersion(null)).toEqual([0, 0, 0]);
    expect(parseVersion(undefined)).toEqual([0, 0, 0]);
    expect(parseVersion("not_deployed")).toEqual([0, 0, 0]);
    expect(parseVersion("1.2")).toEqual([0, 0, 0]);
  });

  it("compares numerically, not lexicographically", () => {
    // The core bug: as strings "1.10.0" < "1.2.0", but semver 1.10.0 > 1.2.0
    expect(compareVersions("1.10.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
  });

  it("sorts ascending and descending by semver", () => {
    const input = ["1.2.0", "1.10.0", "1.1.0", "2.0.0"];
    expect(sortVersionsAscending(input)).toEqual([
      "1.1.0",
      "1.2.0",
      "1.10.0",
      "2.0.0",
    ]);
    expect(sortVersionsDescending(input)).toEqual([
      "2.0.0",
      "1.10.0",
      "1.2.0",
      "1.1.0",
    ]);
    // does not mutate input
    expect(input[0]).toBe("1.2.0");
  });

  it("returns the highest version via semver, not string order", () => {
    expect(maxVersion(["1.2.0", "1.10.0", "1.9.0"])).toBe("1.10.0");
    expect(maxVersion([])).toBeNull();
  });
});
