import axios from "axios";
import type {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { createPrefixedStorage } from "./storage";
import { createTokenManager } from "./create-token-manager";
import type { ApiClient, AuthClientConfig, CsrfConfig } from "./types";

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function normalizeCsrfConfig(raw: AuthClientConfig["csrf"]): CsrfConfig | null {
  if (!raw) return null;
  const defaults: CsrfConfig = {
    headerName: "X-CSRF-Token",
    cookieName: "__Host-mm_csrf",
    protectedMethods: ["POST", "PUT", "DELETE", "PATCH"],
  };
  if (raw === true) return defaults;
  return { ...defaults, ...raw };
}

function getCookieValue(name: string): string | undefined {
  return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1];
}

/**
 * Where the CSRF token survives a page reload.
 *
 * The cookie the API sets carries the `__Host-` prefix, which forces it to be
 * host-only on the API's own origin. Every front-end here is served from a
 * different subdomain, so `document.cookie` cannot see it and the cookie
 * fallback below is structurally dead in production — it only ever works when
 * the API and the app share an origin, as they do behind the dev proxy.
 *
 * Without somewhere to persist it, the token cached from the X-CSRF-Token
 * response header lived in a module variable that a reload wiped, so restoring
 * a session sent no token and every state-changing request 403'd (#66).
 *
 * Storing it is not a new exposure: the bearer token already sits in the same
 * storage, so anything able to read this could already act as the user.
 */
const CSRF_STORAGE_KEY = "mm_csrf_token";

function readStoredCsrfToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(CSRF_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredCsrfToken(token: string): void {
  try {
    globalThis.localStorage?.setItem(CSRF_STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies). The
    // in-memory cache still covers the current page.
  }
}

function clearStoredCsrfToken(): void {
  try {
    globalThis.localStorage?.removeItem(CSRF_STORAGE_KEY);
  } catch {
    // Same as above — nothing to clean up if storage is unavailable.
  }
}

/**
 * Create an authenticated axios-based API client with:
 * - Bearer token from prefixed localStorage
 * - Optional CSRF protection
 * - 401 → token refresh → retry (configurable)
 * - Proactive refresh scheduling
 * - Configurable error handling and request augmentation
 */
export function createAuthenticatedApiClient(
  config: AuthClientConfig,
): ApiClient {
  const storage = createPrefixedStorage(
    config.storageKeyPrefix,
    config.storageKeys,
    config.tokenStorage,
  );
  const csrfConfig = normalizeCsrfConfig(config.csrf);
  const retryOn401 = config.retryOn401 !== false; // default true

  let csrfTokenCache: string | null = csrfConfig ? readStoredCsrfToken() : null;

  const instance = axios.create({
    baseURL: config.baseURL ?? "/api/v1",
    timeout: config.timeout ?? 10000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      ...(config.defaultHeaders ?? {}),
    },
  });

  const tokenManager = createTokenManager({
    storage,
    refreshFn: async () => {
      try {
        const refreshConfig: AxiosRequestConfig & { _retry?: boolean } = {
          _retry: true, // skip 401 interceptor for the refresh call itself
          withCredentials: true,
        };
        const response = await instance.post(
          "/auth/refresh",
          {},
          refreshConfig,
        );

        const data = response.data?.data;
        if (data?.token) {
          return {
            token: data.token,
            refreshToken: data.refreshToken,
            user: data.user,
          };
        }
        return null;
      } catch {
        return null;
      }
    },
    onTokenRefreshed: config.onTokenRefreshed,
    onRefreshFailure: config.onAuthFailure,
  });

  // ── Request interceptor ────────────────────────────────────────────────
  instance.interceptors.request.use(
    (reqConfig) => {
      // Attach Bearer token
      const token = storage.getToken();
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }

      // Attach CSRF token for state-changing methods
      if (csrfConfig) {
        const method = (reqConfig.method || "").toUpperCase();
        if (csrfConfig.protectedMethods.includes(method)) {
          const csrf = csrfTokenCache || getCookieValue(csrfConfig.cookieName);
          if (csrf) {
            reqConfig.headers[csrfConfig.headerName] = csrf;
          }
        }
      }

      // App-specific request augmentation
      if (config.requestInterceptor) {
        return config.requestInterceptor(reqConfig);
      }

      return reqConfig;
    },
    (error) => Promise.reject(error),
  );

  // ── Response interceptor ───────────────────────────────────────────────
  instance.interceptors.response.use(
    (response) => {
      // Cache CSRF token from response headers
      if (csrfConfig) {
        const newCsrf = response.headers[csrfConfig.headerName.toLowerCase()];
        if (newCsrf) {
          csrfTokenCache = newCsrf;
          writeStoredCsrfToken(newCsrf);
        }
      }
      return response;
    },
    async (error: AxiosError) => {
      const original = error.config as RetryableRequest | undefined;

      if (error.response?.status === 401 && original && !original._retry) {
        original._retry = true;

        if (retryOn401) {
          // Attempt refresh + retry the original request
          const success = await tokenManager.refreshToken();
          if (success) {
            const newToken = storage.getToken();
            if (newToken) {
              original.headers = original.headers || {};
              original.headers.Authorization = `Bearer ${newToken}`;
            }
            return instance(original);
          }
        }

        // Refresh failed or retry disabled — clean up and notify. The CSRF
        // token goes with the session: leaving a stale one behind would make
        // the next login's first write fail against a rotated cookie.
        storage.clearAll();
        csrfTokenCache = null;
        clearStoredCsrfToken();
        if (config.onAuthFailure) await config.onAuthFailure();
        return Promise.reject(error);
      }

      // Non-401 errors: delegate to app's error handler if provided
      if (config.errorHandler) {
        return Promise.reject(config.errorHandler(error));
      }
      return Promise.reject(error);
    },
  );

  return {
    instance,
    tokens: tokenManager,

    get: (url, params) => instance.get(url, { params }),
    post: (url, data, cfg) => instance.post(url, data, cfg),
    put: (url, data) => instance.put(url, data),
    patch: (url, data) => instance.patch(url, data),
    delete: (url, data) => instance.delete(url, data ? { data } : undefined),
    upload: (url, formData) =>
      instance.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),

    setAuthToken: (token) => {
      if (token) {
        instance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } else {
        delete instance.defaults.headers.common["Authorization"];
      }
    },

    destroy: () => {
      tokenManager.clearRefreshTimer();
    },
  };
}
