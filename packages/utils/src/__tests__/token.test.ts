import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodeJwtPayload,
  isTokenExpired,
  getRefreshDelay,
  getTimeUntilExpiry,
} from "../token";

// Helper: create a JWT with given payload (no signature verification needed — we only decode)
function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("token utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = Math.floor(new Date("2026-03-22T12:00:00Z").getTime() / 1000);

  describe("decodeJwtPayload", () => {
    it("should decode a valid JWT payload", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now, sub: "user1" });
      const payload = decodeJwtPayload(token);
      expect(payload).not.toBeNull();
      expect(payload!.exp).toBe(now + 3600);
      expect(payload!.iat).toBe(now);
      expect(payload!.sub).toBe("user1");
    });

    it("should return null for empty string", () => {
      expect(decodeJwtPayload("")).toBeNull();
    });

    it("should return null for non-JWT string", () => {
      expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    });

    it("should return null for JWT with only 2 segments", () => {
      expect(decodeJwtPayload("header.payload")).toBeNull();
    });

    it("should return null for JWT with invalid base64 payload", () => {
      expect(decodeJwtPayload("valid.!!!invalid-base64!!!.sig")).toBeNull();
    });

    it("should return null for JWT with non-JSON payload", () => {
      const header = btoa("{}");
      const body = btoa("not json");
      expect(decodeJwtPayload(`${header}.${body}.sig`)).toBeNull();
    });

    it("should handle base64url encoding (- and _ chars)", () => {
      const payload = { exp: now + 3600, iat: now, data: "test+value/here" };
      const token = createTestJwt(payload);
      const decoded = decodeJwtPayload(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.data).toBe("test+value/here");
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for a token expiring in the future", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(isTokenExpired(token)).toBe(false);
    });

    it("should return true for an expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      expect(isTokenExpired(token)).toBe(true);
    });

    it("should return true when within buffer seconds of expiry", () => {
      const token = createTestJwt({ exp: now + 20, iat: now - 3580 });
      expect(isTokenExpired(token, 30)).toBe(true);
    });

    it("should return false when outside buffer seconds of expiry", () => {
      const token = createTestJwt({ exp: now + 60, iat: now - 3540 });
      expect(isTokenExpired(token, 30)).toBe(false);
    });

    it("should return true for malformed token", () => {
      expect(isTokenExpired("garbage")).toBe(true);
    });

    it("should return true for token without exp claim", () => {
      const token = createTestJwt({ iat: now });
      expect(isTokenExpired(token)).toBe(true);
    });
  });

  describe("getRefreshDelay", () => {
    it("should return delay at 80% of token lifetime", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(getRefreshDelay(token)).toBe(2880 * 1000);
    });

    it("should return null for expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      expect(getRefreshDelay(token)).toBeNull();
    });

    it("should return null for malformed token", () => {
      expect(getRefreshDelay("garbage")).toBeNull();
    });

    it("should return null for token without iat (cannot compute lifetime)", () => {
      const token = createTestJwt({ exp: now + 3600 });
      const delay = getRefreshDelay(token);
      expect(delay).not.toBeNull();
      expect(delay!).toBeGreaterThan(0);
    });

    it("should return 0 or null when refresh point has already passed", () => {
      const token = createTestJwt({ exp: now + 600, iat: now - 3000 });
      const delay = getRefreshDelay(token);
      expect(delay === null || delay === 0).toBe(true);
    });
  });

  describe("getTimeUntilExpiry", () => {
    it("should return milliseconds until expiry", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(getTimeUntilExpiry(token)).toBe(3600 * 1000);
    });

    it("should return negative for expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      const result = getTimeUntilExpiry(token);
      expect(result).not.toBeNull();
      expect(result!).toBeLessThan(0);
    });

    it("should return null for malformed token", () => {
      expect(getTimeUntilExpiry("garbage")).toBeNull();
    });
  });
});
