import type { Component } from "vue";

interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

interface LazyComponentOptions {
  loading?: Component;
  error?: Component;
  delay?: number;
  timeout?: number;
  suspensible?: boolean;
  onError?: (error: Error, retry: () => void) => void;
}

type ComponentLoaderResult<T extends Component = Component> =
  | { default: T }
  | T;
type ComponentImport<T extends Component = Component> = () => Promise<
  ComponentLoaderResult<T>
>;
type FeatureImport = () => Promise<unknown>;

const isComponentModule = <T extends Component>(
  result: ComponentLoaderResult<T>,
): result is { default: T } =>
  typeof result === "object" && result !== null && "default" in result;

const resolveComponent = <T extends Component>(
  result: ComponentLoaderResult<T>,
): T => (isComponentModule(result) ? result.default : result);

/**
 * Enhanced lazy loading for Vue components with better error handling
 */
export function lazyComponent<T extends Component = Component>(
  loader: ComponentImport<T>,
  options: LazyComponentOptions = {},
): Component {
  const {
    loading: _loading,
    error: _error,
    delay = 200,
    timeout = 30000,
    suspensible = true,
    onError,
  } = options;

  return {
    name: "LazyComponent",
    async setup() {
      const { ref, onMounted, onErrorCaptured } = await import("vue");

      const component = ref<Component | null>(null);
      const loadingState = ref<LoadingState>({
        isLoading: true,
        error: null,
        retry: () => loadComponent(),
      });

      const loadComponent = async () => {
        loadingState.value.isLoading = true;
        loadingState.value.error = null;

        try {
          const loadPromise = loader();
          let timeoutId: NodeJS.Timeout | null = null;

          // Set timeout
          if (timeout > 0) {
            timeoutId = setTimeout(() => {
              throw new Error(`Component loading timed out after ${timeout}ms`);
            }, timeout);
          }

          const result = await loadPromise;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Handle different module formats
          component.value = resolveComponent(result);
          loadingState.value.isLoading = false;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          loadingState.value.error = error;
          loadingState.value.isLoading = false;

          // Call error handler if provided
          if (onError) {
            onError(error, loadingState.value.retry);
          }

          console.error("Failed to load component:", error);
        }
      };

      onMounted(() => {
        // Add delay if specified
        if (delay > 0) {
          setTimeout(loadComponent, delay);
        } else {
          loadComponent();
        }
      });

      onErrorCaptured((error: Error) => {
        loadingState.value.error = error;
        loadingState.value.isLoading = false;
        return false; // Allow error to propagate
      });

      return {
        component,
        loadingState,
      };
    },
    template: `
      <Suspense v-if="${suspensible}">
        <component :is="component" v-if="component" />
        <template #fallback>
          <component :is="loading" v-if="loading" />
          <div v-else class="lazy-loading">Loading...</div>
        </template>
      </Suspense>
      <div v-else>
        <component :is="component" v-if="component && !loadingState.isLoading && !loadingState.error" />
        <component :is="loading" v-else-if="loadingState.isLoading && loading" />
        <component :is="error" v-else-if="loadingState.error && error" :error="loadingState.error" :retry="loadingState.retry" />
        <div v-else-if="loadingState.isLoading" class="lazy-loading">Loading...</div>
        <div v-else-if="loadingState.error" class="lazy-error">
          Error loading component: {{ loadingState.error.message }}
          <button @click="loadingState.retry" class="retry-btn">Retry</button>
        </div>
      </div>
    `,
  };
}

/**
 * Create route-based code splitting
 */
export function createRouteComponents(routes: Record<string, ComponentImport>) {
  return Object.fromEntries(
    Object.entries(routes).map(([name, loader]) => [
      name,
      lazyComponent(loader, {
        delay: 0, // No delay for route components
        timeout: 15000, // 15 second timeout for routes
      }),
    ]),
  );
}

/**
 * Dynamic component loader with preloading
 */
export class ComponentLoader {
  private cache = new Map<string, Promise<Component>>();
  private loadedComponents = new Map<string, Component>();
  private preloadQueue = new Set<string>();
  private loadingComponents = new Set<string>();

  constructor(private components: Record<string, ComponentImport>) {}

  /**
   * Load component with caching
   */
  async load(name: string): Promise<Component> {
    const loaded = this.loadedComponents.get(name);
    if (loaded) {
      return loaded;
    }

    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    if (!this.components[name]) {
      throw new Error(`Component "${name}" not found`);
    }

    const loadPromise = this.loadComponent(name).then((component) => {
      this.loadedComponents.set(name, component);
      return component;
    });
    this.cache.set(name, loadPromise);

    return loadPromise;
  }

  /**
   * Preload component for faster access
   */
  preload(name: string): void {
    if (
      this.cache.has(name) ||
      this.preloadQueue.has(name) ||
      this.loadingComponents.has(name)
    ) {
      return;
    }

    this.preloadQueue.add(name);

    // Use requestIdleCallback for low-priority preloading
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        this.processPreloadQueue();
      });
    } else {
      // Fallback for environments without requestIdleCallback
      setTimeout(() => {
        this.processPreloadQueue();
      }, 100);
    }
  }

  /**
   * Preload multiple components
   */
  preloadMultiple(names: string[]): void {
    names.forEach((name) => this.preload(name));
  }

  /**
   * Get component synchronously if already loaded
   */
  getLoaded(name: string): Component | null {
    return this.loadedComponents.get(name) ?? null;
  }

  /**
   * Clear cache for specific component or all components
   */
  clearCache(name?: string): void {
    if (name) {
      this.cache.delete(name);
      this.loadedComponents.delete(name);
    } else {
      this.cache.clear();
      this.loadedComponents.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cached: this.loadedComponents.size,
      preloadQueue: this.preloadQueue.size,
      loading: this.loadingComponents.size,
      available: Object.keys(this.components).length,
    };
  }

  private async loadComponent(name: string): Promise<Component> {
    this.loadingComponents.add(name);

    try {
      const loader = this.components[name];
      const result = await loader();
      return resolveComponent(result);
    } catch (error) {
      this.cache.delete(name); // Remove failed load from cache
      throw error;
    } finally {
      this.loadingComponents.delete(name);
    }
  }

  private processPreloadQueue(): void {
    const toPreload = Array.from(this.preloadQueue).slice(0, 3); // Limit concurrent preloads

    toPreload.forEach((name) => {
      this.preloadQueue.delete(name);
      this.load(name).catch((error) => {
        console.warn(`Failed to preload component "${name}":`, error);
      });
    });
  }
}

/**
 * Utility for progressive enhancement and feature detection
 */
export class FeatureLoader {
  private features = new Map<string, FeatureImport>();
  private loadedFeatures = new Set<string>();
  private supportCache = new Map<string, boolean>();

  /**
   * Register a feature with its loader
   */
  register(
    name: string,
    loader: FeatureImport,
    detector?: () => boolean,
  ): void {
    this.features.set(name, loader);

    if (detector) {
      this.supportCache.set(name, detector());
    }
  }

  /**
   * Load feature if supported
   */
  async loadFeature(name: string): Promise<boolean> {
    const loader = this.features.get(name);
    if (!loader) {
      console.warn(`Feature "${name}" not registered`);
      return false;
    }

    // Check if feature is supported
    if (this.supportCache.has(name) && !this.supportCache.get(name)) {
      console.log(`Feature "${name}" not supported, skipping`);
      return false;
    }

    // Check if already loaded
    if (this.loadedFeatures.has(name)) {
      return true;
    }

    try {
      await loader();
      this.loadedFeatures.add(name);
      console.log(`Feature "${name}" loaded successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to load feature "${name}":`, error);
      return false;
    }
  }

  /**
   * Load multiple features in parallel
   */
  async loadFeatures(names: string[]): Promise<Record<string, boolean>> {
    const results = await Promise.allSettled(
      names.map(async (name) => {
        const success = await this.loadFeature(name);
        return { name, success };
      }),
    );

    return results.reduce(
      (acc, result) => {
        if (result.status === "fulfilled") {
          acc[result.value.name] = result.value.success;
        }
        return acc;
      },
      {} as Record<string, boolean>,
    );
  }

  /**
   * Check if feature is loaded
   */
  isLoaded(name: string): boolean {
    return this.loadedFeatures.has(name);
  }
}

/**
 * Webpack magic comments for better chunk naming
 */
export function createChunkName(name: string): string {
  return `/* webpackChunkName: "${name}" */`;
}

/**
 * Create vendor chunk splitting configuration
 */
export function createVendorChunks() {
  return {
    vue: {
      test: /[\\/]node_modules[\\/](vue|@vue)[\\/]/,
      name: "vendor-vue",
      chunks: "all" as const,
      priority: 20,
    },
    ui: {
      test: /[\\/]node_modules[\\/](@heroicons|@headlessui|@tailwindcss)[\\/]/,
      name: "vendor-ui",
      chunks: "all" as const,
      priority: 15,
    },
    utils: {
      test: /[\\/]node_modules[\\/](lodash|dayjs|axios|zod)[\\/]/,
      name: "vendor-utils",
      chunks: "all" as const,
      priority: 10,
    },
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: "vendor",
      chunks: "all" as const,
      priority: 5,
    },
  };
}

export default {
  lazyComponent,
  createRouteComponents,
  ComponentLoader,
  FeatureLoader,
  createChunkName,
  createVendorChunks,
};
