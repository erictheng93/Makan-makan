import { computed } from "vue";
import type { ModuleKey } from "@makanmakan/database";
import { useModuleAccessStore } from "../stores/moduleAccess";

export function useModuleAccess() {
  const store = useModuleAccessStore();

  return {
    hasModule: (key: ModuleKey): boolean =>
      store.effectiveModules[key] === true,
    planTier: computed(() => store.planTier),
    isTrialExpired: computed(
      () =>
        store.planTier === "trial" &&
        store.trialEndsAt !== null &&
        Date.now() > store.trialEndsAt,
    ),
    isLoading: computed(() => store.isLoading),
    isLoaded: computed(() => store.isLoaded),
    error: computed(() => store.error),
    refresh: () => store.fetch({ force: true }),
  };
}
