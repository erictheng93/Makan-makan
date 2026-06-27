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
  const removePersistedToken = () => {
    localStorage.removeItem(tokenKey);
    sessionStorage.removeItem(tokenKey);
  };
  const tokenStorageAdapter =
    tokenStorage === "sessionStorage" ? sessionStorage : localStorage;
  const memoryToken = {
    get: () => memoryTokens.get(tokenKey) ?? null,
    set: (value: string) => {
      memoryTokens.set(tokenKey, value);
      removePersistedToken();
    },
    remove: () => {
      memoryTokens.delete(tokenKey);
      removePersistedToken();
    },
  };

  return {
    getToken: () =>
      tokenStorage === "memory"
        ? memoryToken.get()
        : tokenStorageAdapter.getItem(tokenKey),
    setToken: (v) =>
      tokenStorage === "memory" ? memoryToken.set(v) : setStoredToken(v),
    removeToken: () =>
      tokenStorage === "memory" ? memoryToken.remove() : removePersistedToken(),

    getRefreshToken: () => null,
    setRefreshToken: () => removeRefreshToken(),
    removeRefreshToken: () => removeRefreshToken(),

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
      removePersistedToken();
      removeRefreshToken();
      localStorage.removeItem(userKey);
    },
  };

  function setStoredToken(value: string) {
    memoryTokens.delete(tokenKey);
    const otherStorage =
      tokenStorage === "sessionStorage" ? localStorage : sessionStorage;
    otherStorage.removeItem(tokenKey);
    tokenStorageAdapter.setItem(tokenKey, value);
  }

  function removeRefreshToken() {
    localStorage.removeItem(refreshKey);
    sessionStorage.removeItem(refreshKey);
  }
}
