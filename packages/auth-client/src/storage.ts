import type {
  PrefixedStorage,
  StorageKeyOverrides,
  TokenStorageMode,
} from "./types";

const memoryTokens = new Map<string, string>();

/**
 * Create a localStorage adapter with prefixed keys.
 *
 * Default key pattern: `{prefix}_auth_token`, `{prefix}_refresh_token`, `{prefix}_user`
 *
 * Examples:
 *   prefix='kitchen' → kitchen_auth_token, kitchen_refresh_token, kitchen_user
 *   prefix='customer' → customer_auth_token, customer_refresh_token, customer_user
 *
 * Use `overrides` for apps that don't follow the default pattern:
 *   prefix='auth', overrides={ token: 'auth_token' }
 *   → auth_token, auth_refresh_token, auth_user
 */
export function createPrefixedStorage(
  prefix: string,
  overrides?: StorageKeyOverrides,
  tokenStorage: TokenStorageMode = "localStorage",
): PrefixedStorage {
  const tokenKey = overrides?.token ?? `${prefix}_auth_token`;
  const refreshKey = overrides?.refreshToken ?? `${prefix}_refresh_token`;
  const userKey = overrides?.user ?? `${prefix}_user`;
  const memoryToken = {
    get: () => memoryTokens.get(tokenKey) ?? null,
    set: (value: string) => {
      memoryTokens.set(tokenKey, value);
      localStorage.removeItem(tokenKey);
    },
    remove: () => {
      memoryTokens.delete(tokenKey);
      localStorage.removeItem(tokenKey);
    },
  };

  return {
    getToken: () =>
      tokenStorage === "memory"
        ? memoryToken.get()
        : localStorage.getItem(tokenKey),
    setToken: (v) =>
      tokenStorage === "memory"
        ? memoryToken.set(v)
        : localStorage.setItem(tokenKey, v),
    removeToken: () =>
      tokenStorage === "memory"
        ? memoryToken.remove()
        : localStorage.removeItem(tokenKey),

    getRefreshToken: () => null,
    setRefreshToken: () => localStorage.removeItem(refreshKey),
    removeRefreshToken: () => localStorage.removeItem(refreshKey),

    getUser: <T = unknown>(): T | null => {
      const raw = localStorage.getItem(userKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    setUser: (v) => {
      if (v == null) {
        localStorage.removeItem(userKey);
      } else {
        localStorage.setItem(userKey, JSON.stringify(v));
      }
    },
    removeUser: () => localStorage.removeItem(userKey),

    clearAll: () => {
      memoryTokens.delete(tokenKey);
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(refreshKey);
      localStorage.removeItem(userKey);
    },
  };
}
