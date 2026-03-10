/**
 * Dynamic Component Loading Composable
 *
 * Utilities for lazy loading heavy components and code splitting
 * to reduce initial bundle size and improve performance
 */

import { defineAsyncComponent, type Component } from "vue";

export interface AsyncComponentOptions {
  loadingComponent?: Component;
  errorComponent?: Component;
  delay?: number;
  timeout?: number;
  suspensible?: boolean;
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number,
  ) => void;
}

/**
 * Create an async component with loading and error states
 *
 * @example
 * const HeavyChart = useLazyComponent(() => import('@/components/charts/HeavyChart.vue'), {
 *   delay: 200,
 *   timeout: 10000
 * })
 */
export function useLazyComponent(
  loader: () => Promise<Component>,
  options: AsyncComponentOptions = {},
) {
  const {
    delay = 200,
    timeout = 10000,
    suspensible = false,
    onError,
  } = options;

  return defineAsyncComponent({
    loader,
    delay,
    timeout,
    suspensible,
    onError:
      onError ||
      ((error, retry, fail, attempts) => {
        console.error("[useLazyComponent] Failed to load component:", error);
        if (attempts <= 3) {
          // Retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          console.log(
            `[useLazyComponent] Retrying in ${retryDelay}ms (attempt ${attempts}/3)`,
          );
          setTimeout(retry, retryDelay);
        } else {
          console.error("[useLazyComponent] Max retry attempts reached");
          fail();
        }
      }),
  });
}

/**
 * Preload a component in the background
 * Useful for prefetching heavy components before they're needed
 *
 * @example
 * // Preload analytics components when dashboard is mounted
 * onMounted(() => {
 *   preloadComponent(() => import('@/views/AnalyticsView.vue'))
 * })
 */
export function preloadComponent(
  loader: () => Promise<Component>,
): Promise<Component> {
  return loader().catch((error) => {
    console.warn("[preloadComponent] Failed to preload component:", error);
    throw error;
  });
}

/**
 * Preload multiple components in parallel
 *
 * @example
 * preloadComponents([
 *   () => import('@/components/charts/LineChart.vue'),
 *   () => import('@/components/charts/BarChart.vue')
 * ])
 */
export function preloadComponents(
  loaders: Array<() => Promise<Component>>,
): Promise<Component[]> {
  return Promise.all(loaders.map(preloadComponent));
}

/**
 * Conditionally load component based on feature flag or user permission
 *
 * @example
 * const AdvancedAnalytics = useConditionalComponent(
 *   () => hasPermission('advanced_analytics'),
 *   () => import('@/components/AdvancedAnalytics.vue'),
 *   () => import('@/components/BasicAnalytics.vue')
 * )
 */
export function useConditionalComponent(
  condition: () => boolean,
  trueLoader: () => Promise<Component>,
  falseLoader: () => Promise<Component>,
  options: AsyncComponentOptions = {},
) {
  const loader = condition() ? trueLoader : falseLoader;
  return useLazyComponent(loader, options);
}

/**
 * Load component only when element is visible (Intersection Observer)
 *
 * @example
 * const HeavyTable = useVisibilityComponent(
 *   elementRef,
 *   () => import('@/components/HeavyTable.vue')
 * )
 */
export function useVisibilityComponent(
  targetRef: { value: Element | null },
  loader: () => Promise<Component>,
  options: AsyncComponentOptions & {
    rootMargin?: string;
    threshold?: number;
  } = {},
) {
  const { rootMargin = "200px", threshold = 0.1, ...asyncOptions } = options;

  let hasLoaded = false;
  let componentPromise: Promise<Component> | null = null;

  // Setup Intersection Observer
  if (typeof window !== "undefined" && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            hasLoaded = true;
            componentPromise = loader();
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold },
    );

    if (targetRef.value) {
      observer.observe(targetRef.value);
    }
  }

  return useLazyComponent(() => {
    if (componentPromise) {
      return componentPromise;
    }
    return loader();
  }, asyncOptions);
}

/**
 * Batch component loader for related components
 * Groups component imports to optimize network requests
 *
 * @example
 * const chartComponents = useBatchLoader({
 *   LineChart: () => import('@/components/charts/LineChart.vue'),
 *   BarChart: () => import('@/components/charts/BarChart.vue'),
 *   PieChart: () => import('@/components/charts/PieChart.vue')
 * })
 */
export function useBatchLoader<
  T extends Record<string, () => Promise<Component>>,
>(loaders: T): Record<keyof T, ReturnType<typeof useLazyComponent>> {
  const result = {} as Record<keyof T, ReturnType<typeof useLazyComponent>>;

  for (const [key, loader] of Object.entries(loaders)) {
    result[key as keyof T] = useLazyComponent(loader);
  }

  return result;
}

/**
 * Performance metrics for component loading
 */
export interface ComponentLoadMetrics {
  componentName: string;
  loadTime: number;
  success: boolean;
  error?: Error;
  timestamp: number;
}

const loadMetrics: ComponentLoadMetrics[] = [];

/**
 * Track component loading performance
 */
export function useComponentMetrics(componentName: string) {
  const startTime = performance.now();

  const recordSuccess = () => {
    const loadTime = performance.now() - startTime;
    loadMetrics.push({
      componentName,
      loadTime,
      success: true,
      timestamp: Date.now(),
    });
    console.log(
      `[ComponentMetrics] ${componentName} loaded in ${loadTime.toFixed(2)}ms`,
    );
  };

  const recordError = (error: Error) => {
    const loadTime = performance.now() - startTime;
    loadMetrics.push({
      componentName,
      loadTime,
      success: false,
      error,
      timestamp: Date.now(),
    });
    console.error(
      `[ComponentMetrics] ${componentName} failed after ${loadTime.toFixed(2)}ms`,
      error,
    );
  };

  return {
    recordSuccess,
    recordError,
    getMetrics: () => loadMetrics,
  };
}

/**
 * Create a component with automatic metrics tracking
 */
export function useLazyComponentWithMetrics(
  componentName: string,
  loader: () => Promise<Component>,
  options: AsyncComponentOptions = {},
) {
  const metrics = useComponentMetrics(componentName);

  return useLazyComponent(async () => {
    try {
      const component = await loader();
      metrics.recordSuccess();
      return component;
    } catch (error) {
      metrics.recordError(error as Error);
      throw error;
    }
  }, options);
}
