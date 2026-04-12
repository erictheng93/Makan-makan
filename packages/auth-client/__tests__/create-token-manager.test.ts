import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTokenManager } from "../src/create-token-manager";
import type { PrefixedStorage, RefreshResult } from "../src/types";

// Helper: create a JWT with given payload
function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function createMockStorage(): PrefixedStorage & {
  _store: Record<string, string>;
} {
  const _store: Record<string, string> = {};
  return {
    _store,
    getToken: () => _store["token"] ?? null,
    setToken: (v) => {
      _store["token"] = v;
    },
    removeToken: () => delete _store["token"],
    getRefreshToken: () => _store["refresh"] ?? null,
    setRefreshToken: (v) => {
      _store["refresh"] = v;
    },
    removeRefreshToken: () => delete _store["refresh"],
    getUser: () => {
      const raw = _store["user"];
      return raw ? JSON.parse(raw) : null;
    },
    setUser: (v) => {
      if (v == null) delete _store["user"];
      else _store["user"] = JSON.stringify(v);
    },
    removeUser: () => delete _store["user"],
    clearAll: () => {
      delete _store["token"];
      delete _store["refresh"];
      delete _store["user"];
    },
  };
}

describe("createTokenManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = Math.floor(new Date("2026-03-22T12:00:00Z").getTime() / 1000);

  describe("basic storage delegation", () => {
    it("should read/write tokens via storage", () => {
      const storage = createMockStorage();
      const tm = createTokenManager({ storage });

      tm.setTokens("access", "refresh");
      expect(tm.getToken()).toBe("access");
      expect(tm.getRefreshToken()).toBe("refresh");

      tm.setUser({ id: 1 });
      expect(tm.getUser()).toEqual({ id: 1 });

      tm.clearAll();
      expect(tm.getToken()).toBeNull();
      expect(tm.getRefreshToken()).toBeNull();
      expect(tm.getUser()).toBeNull();
    });
  });

  describe("scheduleProactiveRefresh", () => {
    it("should schedule refresh at 80% of token lifetime", async () => {
      const storage = createMockStorage();
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockResolvedValue({ token: "new-tok" });
      const tm = createTokenManager({ storage, refreshFn });

      // Token: iat=now, exp=now+1000s → 80% = 800s
      const token = createTestJwt({ iat: now, exp: now + 1000 });
      tm.scheduleProactiveRefresh(token);

      // At 799s, nothing should have fired
      await vi.advanceTimersByTimeAsync(799_000);
      expect(refreshFn).not.toHaveBeenCalled();

      // At 800s, refresh should fire
      await vi.advanceTimersByTimeAsync(1_000);
      expect(refreshFn).toHaveBeenCalledOnce();
    });

    it("should clear previous timer when rescheduling", async () => {
      const storage = createMockStorage();
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockResolvedValue({ token: "t" });
      const tm = createTokenManager({ storage, refreshFn });

      const token1 = createTestJwt({ iat: now, exp: now + 1000 });
      tm.scheduleProactiveRefresh(token1);

      // Reschedule with a new token before first timer fires
      const token2 = createTestJwt({ iat: now, exp: now + 2000 });
      tm.scheduleProactiveRefresh(token2);

      // Advance past first timer (800s) — should NOT have fired because it was cleared
      await vi.advanceTimersByTimeAsync(800_000);
      expect(refreshFn).not.toHaveBeenCalled();

      // Advance to second timer (1600s)
      await vi.advanceTimersByTimeAsync(800_000);
      expect(refreshFn).toHaveBeenCalledOnce();
    });
  });

  describe("refreshToken deduplication", () => {
    it("should deduplicate concurrent refresh calls", async () => {
      const storage = createMockStorage();
      storage.setRefreshToken("rt");

      let resolveRefresh!: (v: RefreshResult | null) => void;
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        );

      const tm = createTokenManager({ storage, refreshFn });

      // Fire 3 concurrent refreshes
      const p1 = tm.refreshToken();
      const p2 = tm.refreshToken();
      const p3 = tm.refreshToken();

      // Only 1 actual call should have been made
      expect(refreshFn).toHaveBeenCalledOnce();

      // Resolve the single call
      resolveRefresh({ token: "new-tok", refreshToken: "new-rt" });

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);

      // Tokens should be persisted
      expect(storage.getToken()).toBe("new-tok");
      expect(storage.getRefreshToken()).toBe("new-rt");
    });

    it("should call onTokenRefreshed on success", async () => {
      const storage = createMockStorage();
      const onTokenRefreshed = vi.fn();
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockResolvedValue({ token: "t", refreshToken: "rt", user: { id: 1 } });

      const tm = createTokenManager({
        storage,
        refreshFn,
        onTokenRefreshed,
      });

      await tm.refreshToken();
      expect(onTokenRefreshed).toHaveBeenCalledWith({
        token: "t",
        refreshToken: "rt",
        user: { id: 1 },
      });
    });

    it("should call onRefreshFailure when refresh returns null", async () => {
      const storage = createMockStorage();
      const onRefreshFailure = vi.fn();
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockResolvedValue(null);

      const tm = createTokenManager({
        storage,
        refreshFn,
        onRefreshFailure,
      });

      const result = await tm.refreshToken();
      expect(result).toBe(false);
      expect(onRefreshFailure).toHaveBeenCalledOnce();
    });

    it("should call onRefreshFailure when refresh throws", async () => {
      const storage = createMockStorage();
      const onRefreshFailure = vi.fn();
      const refreshFn = vi
        .fn<() => Promise<RefreshResult | null>>()
        .mockRejectedValue(new Error("network"));

      const tm = createTokenManager({
        storage,
        refreshFn,
        onRefreshFailure,
      });

      const result = await tm.refreshToken();
      expect(result).toBe(false);
      expect(onRefreshFailure).toHaveBeenCalledOnce();
    });

    it("should return false when no refreshFn is provided", async () => {
      const storage = createMockStorage();
      const tm = createTokenManager({ storage });
      expect(await tm.refreshToken()).toBe(false);
    });
  });
});
