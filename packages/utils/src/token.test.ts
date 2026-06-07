import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeJwtPayload,
  getRefreshDelay,
  getTimeUntilExpiry,
  isTokenExpired,
} from "./token";

function makeJwt(payload: Record<string, unknown>) {
  return [
    "header",
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("token utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("decodes base64url JWT payloads and safely rejects malformed tokens", () => {
    expect(decodeJwtPayload(makeJwt({ exp: 200, iat: 100, role: 1 }))).toEqual({
      exp: 200,
      iat: 100,
      role: 1,
    });
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("a.broken.c")).toBeNull();
  });

  it("treats malformed, expired, and buffered tokens as expired", () => {
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);

    expect(isTokenExpired("bad")).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: now - 1 }))).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: now + 30 }), 60)).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: now + 120 }), 60)).toBe(false);
  });

  it("calculates proactive refresh and expiry delays", () => {
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt({ iat: now - 100, exp: now + 100 });

    expect(getRefreshDelay(token)).toBe(60_000);
    expect(getTimeUntilExpiry(token)).toBe(100_000);
    expect(getRefreshDelay(makeJwt({ exp: now - 1 }))).toBeNull();
  });
});
