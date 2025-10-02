/**
 * Dynamic Component Loading Composable
 *
 * Utilities for lazy loading heavy components and code splitting
 * to reduce initial bundle size and improve PWA performance
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
 * Optimized for PWA with retry logic and offline support
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

        // Check if offline
        if (!navigator.onLine) {
          console.warn(
            "[useLazyComponent] Device is offline, will retry when online",
          );
          const onlineHandler = () => {
            console.log("[useLazyComponent] Device back online, retrying...");
            window.removeEventListener("online", onlineHandler);
            retry();
          };
          window.addEventListener("online", onlineHandler);
          return;
        }

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
 * Preload component in background (PWA optimization)
 * Uses Service Worker cache if available
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
 */
export function preloadComponents(
  loaders: Array<() => Promise<Component>>,
): Promise<Component[]> {
  return Promise.all(loaders.map(preloadComponent));
}

/**
 * Load component only when element is visible (Intersection Observer)
 * Perfect for below-the-fold content in menu views
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
 * Load component based on connection speed (Network Information API)
 * Automatically skip heavy components on slow connections
 */
export function useAdaptiveComponent(
  lightLoader: () => Promise<Component>,
  heavyLoader: () => Promise<Component>,
  options: AsyncComponentOptions = {},
) {
  const getConnectionSpeed = (): "slow" | "fast" => {
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        // 2G or slow-2g = slow
        if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
          return "slow";
        }
        // saveData mode = slow
        if (conn.saveData) {
          return "slow";
        }
      }
    }
    return "fast";
  };

  const loader = getConnectionSpeed() === "slow" ? lightLoader : heavyLoader;
  return useLazyComponent(loader, options);
}

/**
 * Performance metrics for component loading (PWA-specific)
 */
export interface ComponentLoadMetrics {
  componentName: string;
  loadTime: number;
  success: boolean;
  connectionType?: string;
  cacheHit?: boolean;
  error?: Error;
  timestamp: number;
}

const loadMetrics: ComponentLoadMetrics[] = [];

/**
 * Track component loading performance with PWA metrics
 */
export function useComponentMetrics(componentName: string) {
  const startTime = performance.now();

  const getConnectionType = (): string => {
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      return conn?.effectiveType || "unknown";
    }
    return "unknown";
  };

  const recordSuccess = (cacheHit = false) => {
    const loadTime = performance.now() - startTime;
    loadMetrics.push({
      componentName,
      loadTime,
      success: true,
      connectionType: getConnectionType(),
      cacheHit,
      timestamp: Date.now(),
    });
    console.log(
      `[ComponentMetrics] ${componentName} loaded in ${loadTime.toFixed(2)}ms (cache: ${cacheHit})`,
    );
  };

  const recordError = (error: Error) => {
    const loadTime = performance.now() - startTime;
    loadMetrics.push({
      componentName,
      loadTime,
      success: false,
      connectionType: getConnectionType(),
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
