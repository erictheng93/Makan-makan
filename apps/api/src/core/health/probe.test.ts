import { describe, expect, it, vi } from "vitest";
import { isDeepHealthRequest, probeCache, probeDatabase } from "./probe";

describe("probeDatabase", () => {
  it("reports healthy when the query round-trips", async () => {
    const first = vi.fn(async () => ({ ok: 1 }));
    const db = { prepare: vi.fn(() => ({ first })) } as never;

    const result = await probeDatabase(db);

    expect(result.healthy).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // The whole point of probing: an outage has to surface. The previous
  // implementation derived health from in-process counters and reported
  // "healthy" regardless of whether D1 was reachable.
  it("reports unhealthy when the database throws", async () => {
    const db = {
      prepare: vi.fn(() => ({
        first: vi.fn(async () => {
          throw new Error("D1_ERROR: connection lost");
        }),
      })),
    } as never;

    const result = await probeDatabase(db);

    expect(result.healthy).toBe(false);
    expect(result.error).toContain("connection lost");
  });

  it("reports unhealthy on an unexpected result rather than assuming success", async () => {
    const db = {
      prepare: vi.fn(() => ({ first: vi.fn(async () => null) })),
    } as never;

    const result = await probeDatabase(db);

    expect(result.healthy).toBe(false);
    expect(result.error).toBe("unexpected probe result");
  });

  it("reports unhealthy when the binding is missing", async () => {
    const result = await probeDatabase(undefined);

    expect(result.healthy).toBe(false);
    expect(result.error).toContain("not configured");
  });
});

describe("probeCache", () => {
  it("treats a reachable namespace as healthy even on a key miss", async () => {
    // A miss still proves the round trip worked.
    const kv = { get: vi.fn(async () => null) } as never;

    const result = await probeCache(kv);

    expect(result.healthy).toBe(true);
  });

  it("does not write, so a public health endpoint cannot burn write quota", async () => {
    const put = vi.fn();
    const kv = { get: vi.fn(async () => null), put } as never;

    await probeCache(kv);

    expect(put).not.toHaveBeenCalled();
  });

  it("reports unhealthy when KV throws", async () => {
    const kv = {
      get: vi.fn(async () => {
        throw new Error("KV unreachable");
      }),
    } as never;

    const result = await probeCache(kv);

    expect(result.healthy).toBe(false);
    expect(result.error).toContain("KV unreachable");
  });
});

describe("isDeepHealthRequest", () => {
  it("is off by default, so the public probe stays read-only", () => {
    expect(
      isDeepHealthRequest("https://api.example.com/api/v1/system/health"),
    ).toBe(false);
  });

  it.each(["?deep", "?deep=1", "?deep=true", "?deep=yes"])(
    "opts in on %s",
    (query) => {
      expect(
        isDeepHealthRequest(
          `https://api.example.com/api/v1/system/health${query}`,
        ),
      ).toBe(true);
    },
  );

  it.each(["?deep=0", "?deep=false"])("treats %s as an opt-out", (query) => {
    // These are non-empty strings, so "the param is present" would read them
    // as opting in — the opposite of what they say.
    expect(
      isDeepHealthRequest(
        `https://api.example.com/api/v1/system/health${query}`,
      ),
    ).toBe(false);
  });

  it("falls back to the cheap probe on a URL it cannot parse", () => {
    expect(isDeepHealthRequest("/api/v1/system/health?deep=1")).toBe(false);
  });
});
