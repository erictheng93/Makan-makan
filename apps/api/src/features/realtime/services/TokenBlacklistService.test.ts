import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBlacklistService } from "./TokenBlacklistService";

const loggerFns = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return loggerFns;
  }),
}));

function createKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const calls = {
    put: [] as Array<{
      key: string;
      value: string;
      options?: { expirationTtl?: number };
    }>,
    delete: [] as string[],
    list: [] as Array<{ prefix?: string; limit?: number }>,
  };

  return {
    store,
    calls,
    kv: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          options?: { expirationTtl?: number },
        ) => {
          calls.put.push({ key, value, options });
          store.set(key, value);
        },
      ),
      delete: vi.fn(async (key: string) => {
        calls.delete.push(key);
        store.delete(key);
      }),
      list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
        calls.list.push(options ?? {});
        const prefix = options?.prefix ?? "";
        const limit = options?.limit ?? Number.POSITIVE_INFINITY;
        const keys = Array.from(store.keys())
          .filter((key) => key.startsWith(prefix))
          .slice(0, limit)
          .map((name) => ({ name }));

        return { keys, list_complete: true, cursor: undefined };
      }),
    },
  };
}

const longToken = `${"a".repeat(32)}${"b".repeat(12)}${"z".repeat(8)}`;

async function tokenHashId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `sha256:${hash}`;
}

describe("TokenBlacklistService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T05:06:07.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("revokes short and long tokens with TTLs and records metadata", async () => {
    const { kv, calls } = createKv();
    const service = new TokenBlacklistService(kv as never);
    const shortTokenId = await tokenHashId("short-token");
    const longTokenId = await tokenHashId(longToken);

    await expect(
      service.revokeToken("short-token", "logout", {
        revokedBy: "user-1",
        ttlSeconds: 60,
        metadata: { ip: "203.0.113.10" },
      }),
    ).resolves.toEqual({ success: true, tokenId: shortTokenId });
    await expect(
      service.revokeToken(longToken, "security_breach"),
    ).resolves.toEqual({ success: true, tokenId: longTokenId });

    expect(calls.put[0]).toEqual({
      key: `token:revoked:${shortTokenId}`,
      value: JSON.stringify({
        tokenId: shortTokenId,
        revokedAt: Date.parse("2026-06-07T05:06:07.000Z"),
        reason: "logout",
        revokedBy: "user-1",
        metadata: { ip: "203.0.113.10" },
      }),
      options: { expirationTtl: 60 },
    });
    expect(calls.put[1]).toMatchObject({
      key: `token:revoked:${longTokenId}`,
      options: { expirationTtl: 5 * 60 },
    });
    expect(loggerFns.info).toHaveBeenCalledWith("Token revoked", {
      tokenId: shortTokenId,
      reason: "logout",
      revokedBy: "user-1",
    });
  });

  it("checks and reads revoke records, failing closed on revocation lookups", async () => {
    const tokenOneId = await tokenHashId("token-1");
    const badJsonId = await tokenHashId("bad-json");
    const record = {
      tokenId: tokenOneId,
      revokedAt: Date.now(),
      reason: "manual",
    };
    const { kv } = createKv({
      [`token:revoked:${tokenOneId}`]: JSON.stringify(record),
      [`token:revoked:${badJsonId}`]: "{",
    });
    const service = new TokenBlacklistService(kv as never);

    await expect(service.isTokenRevoked("token-1")).resolves.toBe(true);
    await expect(service.isTokenRevoked("missing")).resolves.toBe(false);
    await expect(service.getRevokeRecord("token-1")).resolves.toEqual(record);
    await expect(service.getRevokeRecord("missing")).resolves.toBeNull();
    await expect(service.getRevokeRecord("bad-json")).resolves.toBeNull();

    vi.mocked(kv.get).mockRejectedValueOnce(new Error("kv down"));
    await expect(service.isTokenRevoked("token-1")).resolves.toBe(true);
    expect(loggerFns.error).toHaveBeenCalledWith(
      "Failed to check token revocation",
      expect.any(Error),
    );
  });

  it("revokes all tracked user tokens and clears the user token index", async () => {
    const tokenOneId = await tokenHashId("token-1");
    const tokenTwoId = await tokenHashId("token-2");
    const { kv, calls } = createKv({
      "user:tokens:user-1": JSON.stringify([tokenOneId, tokenTwoId]),
    });
    const service = new TokenBlacklistService(kv as never);

    await expect(
      service.revokeUserTokens("user-1", "permission_change", "admin-1"),
    ).resolves.toEqual({ success: true, count: 2 });

    expect(calls.put).toHaveLength(2);
    expect(calls.put).toEqual([
      expect.objectContaining({
        key: `token:revoked:${tokenOneId}`,
        options: { expirationTtl: 5 * 60 },
      }),
      expect.objectContaining({
        key: `token:revoked:${tokenTwoId}`,
        options: { expirationTtl: 5 * 60 },
      }),
    ]);
    expect(JSON.parse(calls.put[0].value)).toMatchObject({
      tokenId: tokenOneId,
      reason: "permission_change",
      revokedBy: "admin-1",
    });
    expect(calls.delete).toEqual(["user:tokens:user-1"]);
    expect(loggerFns.info).toHaveBeenCalledWith("User tokens revoked", {
      userId: "user-1",
      count: 2,
      reason: "permission_change",
    });
  });

  it("returns zero when a user has no tracked tokens and propagates revoke failures", async () => {
    const { kv } = createKv();
    const service = new TokenBlacklistService(kv as never);

    await expect(
      service.revokeUserTokens("missing", "logout"),
    ).resolves.toEqual({
      success: true,
      count: 0,
    });

    vi.mocked(kv.get).mockRejectedValueOnce(new Error("kv unavailable"));
    await expect(service.revokeUserTokens("user-1", "logout")).rejects.toThrow(
      "kv unavailable",
    );
    expect(loggerFns.error).toHaveBeenCalledWith(
      "Failed to revoke user tokens",
      expect.any(Error),
    );
  });

  it("tracks recent user tokens with dedup-free rolling storage and swallows tracking failures", async () => {
    const existing = Array.from({ length: 10 }, (_, index) => `old-${index}`);
    const { kv, calls, store } = createKv({
      "user:tokens:user-1": JSON.stringify(existing),
    });
    const service = new TokenBlacklistService(kv as never);
    const longTokenId = await tokenHashId(longToken);

    await service.trackUserToken("user-1", longToken);

    expect(calls.put).toHaveLength(1);
    expect(calls.put[0]).toMatchObject({
      key: "user:tokens:user-1",
      options: { expirationTtl: 10 * 60 },
    });
    expect(JSON.parse(store.get("user:tokens:user-1") ?? "[]")).toEqual([
      ...existing.slice(1),
      longTokenId,
    ]);

    vi.mocked(kv.get).mockRejectedValueOnce(new Error("kv down"));
    await expect(
      service.trackUserToken("user-2", "token-2"),
    ).resolves.toBeUndefined();
    expect(loggerFns.error).toHaveBeenCalledWith(
      "Failed to track user token",
      expect.any(Error),
    );
  });

  it("returns blacklist stats from sampled revoked token records and falls back on stats failures", async () => {
    const records = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [
        `token:revoked:token-${index}`,
        JSON.stringify({
          tokenId: `token-${index}`,
          revokedAt: index,
          reason: "manual",
        }),
      ]),
    );
    const { kv, calls } = createKv({
      ...records,
      "user:tokens:user-1": JSON.stringify(["ignored"]),
    });
    const service = new TokenBlacklistService(kv as never);

    await expect(service.getStats()).resolves.toEqual({
      estimatedCount: 6,
      sampleRecords: [
        { tokenId: "token-0", revokedAt: 0, reason: "manual" },
        { tokenId: "token-1", revokedAt: 1, reason: "manual" },
        { tokenId: "token-2", revokedAt: 2, reason: "manual" },
        { tokenId: "token-3", revokedAt: 3, reason: "manual" },
        { tokenId: "token-4", revokedAt: 4, reason: "manual" },
      ],
    });
    expect(calls.list).toEqual([{ prefix: "token:revoked:", limit: 100 }]);

    vi.mocked(kv.list).mockRejectedValueOnce(new Error("list failed"));
    await expect(service.getStats()).resolves.toEqual({
      estimatedCount: 0,
      sampleRecords: [],
    });
  });
});
