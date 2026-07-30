import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Pins the datetime contract across the #91 batch-3 migration.
 *
 * `z.string().datetime()` is deprecated in favour of `z.iso.datetime()`, but the
 * two are separate implementations, and datetime strictness (offsets, missing
 * timezone, fractional seconds) is exactly where a silent difference would
 * change which requests the API accepts. This asserts they agree on every shape
 * the codebase can receive, so the swap is provably behaviour-preserving rather
 * than assumed to be.
 *
 * Keep this after the migration: it now guards `z.iso.datetime()` against the
 * documented shapes regardless of the deprecated form.
 */
const CASES: Array<[label: string, value: string]> = [
  ["utc with Z", "2026-01-01T00:00:00Z"],
  ["utc with milliseconds", "2026-01-01T00:00:00.123Z"],
  ["utc with microseconds", "2026-01-01T00:00:00.123456Z"],
  ["positive offset", "2026-01-01T08:00:00+08:00"],
  ["negative offset", "2026-01-01T00:00:00-05:00"],
  ["offset without colon", "2026-01-01T08:00:00+0800"],
  ["no timezone", "2026-01-01T00:00:00"],
  ["date only", "2026-01-01"],
  ["lowercase t separator", "2026-01-01t00:00:00Z"],
  ["space separator", "2026-01-01 00:00:00Z"],
  ["leap second", "2026-12-31T23:59:60Z"],
  ["month out of range", "2026-13-01T00:00:00Z"],
  ["day out of range", "2026-01-32T00:00:00Z"],
  ["hour out of range", "2026-01-01T24:00:00Z"],
  ["empty string", ""],
  ["not a date", "nonsense"],
];

const deprecated = z.string().datetime();
const modern = z.iso.datetime();

describe("z.iso.datetime() matches the deprecated z.string().datetime()", () => {
  for (const [label, value] of CASES) {
    it(label, () => {
      const before = deprecated.safeParse(value).success;
      const after = modern.safeParse(value).success;
      expect(
        after,
        `"${value}" — deprecated accepted=${before}, z.iso.datetime() accepted=${after}. ` +
          `A difference here changes which requests the API accepts.`,
      ).toBe(before);
    });
  }

  it("both still accept the canonical UTC form the API emits", () => {
    const emitted = new Date("2026-01-01T00:00:00.000Z").toISOString();
    expect(deprecated.safeParse(emitted).success).toBe(true);
    expect(modern.safeParse(emitted).success).toBe(true);
  });
});
