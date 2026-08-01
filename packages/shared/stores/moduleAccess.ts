import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ModuleKey, PlanTier } from "../types/module-access";

export interface ModuleAccessData {
  restaurantId: string | null;
  planTier: PlanTier | null;
  isActive: boolean;
  trialEndsAt: number | null;
  effectiveModules: Partial<Record<ModuleKey, boolean>>;
}

interface ModuleAccessResponse {
  success: true;
  data: ModuleAccessData;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * How this store reaches the API. Injected by the host app rather than read
 * from `import.meta.env` here, because this package is bundled from source by
 * each consuming app and has no Vite env types of its own.
 *
 * The default base only works when the app is served from the same origin as
 * the API (i.e. dev, behind the Vite `/api` proxy). In production the admin app
 * is on a different host than the API, so a relative URL lands on the Pages SPA
 * fallback: 200 with `text/html`, which passes `response.ok` and then fails at
 * `.json()`. `assertJson` below turns that into a visible error instead.
 */
interface ModuleAccessTransport {
  /** API base, e.g. `https://api.makanmasak.com/api/v1`. */
  baseUrl: string;
  /** Bearer token, or null when the host authenticates by cookie only. */
  getToken: () => string | null;
}

const transport: ModuleAccessTransport = {
  baseUrl: "/api/v1",
  getToken: () => null,
};

/** Call once during app bootstrap, before the first `fetch()`. */
export function configureModuleAccess(
  options: Partial<ModuleAccessTransport>,
): void {
  if (options.baseUrl !== undefined) transport.baseUrl = options.baseUrl;
  if (options.getToken !== undefined) transport.getToken = options.getToken;
}

function modulesUrl(): string {
  return `${transport.baseUrl.replace(/\/$/, "")}/me/modules`;
}

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = transport.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const emptyAccess: ModuleAccessData = {
  restaurantId: null,
  planTier: null,
  isActive: false,
  trialEndsAt: null,
  effectiveModules: {},
};

export const useModuleAccessStore = defineStore("moduleAccess", () => {
  const data = ref<ModuleAccessData>(emptyAccess);
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const error = ref<Error | null>(null);
  const lastFetchedAt = ref<number | null>(null);

  const effectiveModules = computed(() => data.value.effectiveModules);
  const planTier = computed(() => data.value.planTier);
  const trialEndsAt = computed(() => data.value.trialEndsAt);

  async function fetchAccess(options: { force?: boolean } = {}) {
    const now = Date.now();
    const isFresh =
      lastFetchedAt.value !== null && now - lastFetchedAt.value < CACHE_TTL_MS;

    if (!options.force && isLoaded.value && isFresh) {
      return data.value;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const url = modulesUrl();
      const response = await fetch(url, {
        credentials: "include",
        headers: requestHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        reset();
        return data.value;
      }

      if (!response.ok) {
        throw new Error(`Failed to load module access (${response.status})`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // Almost always a misconfigured base URL: the request reached a static
        // host's SPA fallback rather than the API.
        throw new Error(
          `Expected JSON from ${url} but received "${contentType}"`,
        );
      }

      const body = (await response.json()) as ModuleAccessResponse;
      data.value = body.data ?? emptyAccess;
      isLoaded.value = true;
      lastFetchedAt.value = Date.now();
      return data.value;
    } catch (caught) {
      error.value =
        caught instanceof Error ? caught : new Error(String(caught));
      return data.value;
    } finally {
      isLoading.value = false;
    }
  }

  function reset() {
    data.value = emptyAccess;
    isLoaded.value = false;
    lastFetchedAt.value = null;
    error.value = null;
  }

  return {
    data,
    effectiveModules,
    planTier,
    trialEndsAt,
    isLoading,
    isLoaded,
    error,
    fetch: fetchAccess,
    reset,
  };
});
