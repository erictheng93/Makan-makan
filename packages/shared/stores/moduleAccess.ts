import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ModuleKey, PlanTier } from "@makanmakan/database";

export type DeploymentMode = "managed" | "byoc";

export interface ModuleAccessData {
  restaurantId: string | null;
  planTier: PlanTier | null;
  isActive: boolean;
  trialEndsAt: number | null;
  deploymentMode: DeploymentMode;
  effectiveModules: Partial<Record<ModuleKey, boolean>>;
}

interface ModuleAccessResponse {
  success: true;
  data: ModuleAccessData;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const emptyAccess: ModuleAccessData = {
  restaurantId: null,
  planTier: null,
  isActive: false,
  trialEndsAt: null,
  deploymentMode: "managed",
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
  const deploymentMode = computed(() => data.value.deploymentMode);

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
      const response = await fetch("/api/v1/me/modules", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        reset();
        return data.value;
      }

      if (!response.ok) {
        throw new Error(`Failed to load module access (${response.status})`);
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
    deploymentMode,
    isLoading,
    isLoaded,
    error,
    fetch: fetchAccess,
    reset,
  };
});
