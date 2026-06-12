import { getRefreshDelay } from "@makanmakan/utils";
import type { TokenManager, TokenManagerConfig } from "./types";

/**
 * Create a token manager that handles:
 * - Prefixed localStorage read/write via the provided storage adapter
 * - Proactive token refresh at 80% of token lifetime
 * - Concurrent refresh deduplication (only one in-flight refresh at a time)
 */
export function createTokenManager(config: TokenManagerConfig): TokenManager {
  const { storage, refreshFn, onTokenRefreshed, onRefreshFailure } = config;

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let sharedRefreshPromise: Promise<boolean> | null = null;

  const clearRefreshTimer = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    if (!refreshFn) return false;

    // Deduplicate: if a refresh is already in flight, reuse it
    if (sharedRefreshPromise) return sharedRefreshPromise;

    sharedRefreshPromise = (async () => {
      try {
        const result = await refreshFn();
        if (!result) {
          if (onRefreshFailure) await onRefreshFailure();
          return false;
        }

        // Persist new tokens
        storage.setToken(result.token);
        storage.removeRefreshToken();

        if (onTokenRefreshed) onTokenRefreshed(result);
        return true;
      } catch {
        if (onRefreshFailure) await onRefreshFailure();
        return false;
      }
    })();

    try {
      return await sharedRefreshPromise;
    } finally {
      sharedRefreshPromise = null;
    }
  };

  const scheduleProactiveRefresh = (token: string) => {
    clearRefreshTimer();
    const delay = getRefreshDelay(token);
    if (!delay || delay <= 0) return;
    refreshTimer = setTimeout(async () => {
      await refreshToken();
    }, delay);
  };

  return {
    getToken: () => storage.getToken(),
    getRefreshToken: () => storage.getRefreshToken(),
    setTokens: (token) => {
      storage.setToken(token);
      storage.removeRefreshToken();
    },
    setUser: (user) => storage.setUser(user),
    getUser: <T = unknown>() => storage.getUser<T>(),
    clearAll: () => {
      clearRefreshTimer();
      storage.clearAll();
    },
    scheduleProactiveRefresh,
    clearRefreshTimer,
    refreshToken,
  };
}
