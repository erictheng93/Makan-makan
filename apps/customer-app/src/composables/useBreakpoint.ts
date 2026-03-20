// apps/customer-app/src/composables/useBreakpoint.ts
import { ref, onMounted, onUnmounted } from "vue";

export function useIsDesktop() {
  const isDesktop = ref(
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );

  let query: MediaQueryList | null = null;

  const update = (e: MediaQueryListEvent) => {
    isDesktop.value = e.matches;
  };

  onMounted(() => {
    query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;
    query.addEventListener("change", update);
  });

  onUnmounted(() => {
    query?.removeEventListener("change", update);
  });

  return isDesktop;
}
