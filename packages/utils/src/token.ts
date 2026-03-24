/**
 * Decode JWT payload without external library.
 * Returns null if token is malformed.
 */
export function decodeJwtPayload(
  token: string,
): { exp: number; iat: number; [key: string]: unknown } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Convert base64url to base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json);

    if (typeof payload !== "object" || payload === null) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired.
 * Returns true if token is malformed or expired (safe default).
 */
export function isTokenExpired(token: string, bufferSeconds = 0): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - bufferSeconds <= nowSeconds;
}

/**
 * Get milliseconds until token should be refreshed (at 80% of lifetime).
 * Returns null if token is malformed or already past refresh point.
 */
export function getRefreshDelay(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;

  const nowMs = Date.now();
  const expMs = payload.exp * 1000;

  if (expMs <= nowMs) return null;

  // If iat exists, use full lifetime; otherwise use remaining time
  const iatMs = typeof payload.iat === "number" ? payload.iat * 1000 : nowMs;
  const lifetime = expMs - iatMs;
  const refreshAtMs = iatMs + lifetime * 0.8;
  const delay = refreshAtMs - nowMs;

  return delay > 0 ? delay : 0;
}

/**
 * Get milliseconds until token expires.
 * Returns null if token is malformed.
 */
export function getTimeUntilExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;

  return payload.exp * 1000 - Date.now();
}
