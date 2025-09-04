import { ref, computed } from "vue";

interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  memoryUsage: number;
  renderTime: number;
  resourceCount: number;
  cachedResources: number;
}

interface OptimizationConfig {
  enableLazyLoading: boolean;
  enableServiceWorker: boolean;
  enableResourceHints: boolean;
  enableImageOptimization: boolean;
  enableComponentCache: boolean;
  chunkPreloadThreshold: number;
}

class PerformanceOptimizationService {
  private metrics = ref<PerformanceMetrics>({
    bundleSize: 0,
    loadTime: 0,
    memoryUsage: 0,
    renderTime: 0,
    resourceCount: 0,
    cachedResources: 0,
  });

  private config = ref<OptimizationConfig>({
    enableLazyLoading: true,
    enableServiceWorker: true,
    enableResourceHints: true,
    enableImageOptimization: true,
    enableComponentCache: true,
    chunkPreloadThreshold: 0.5, // Preload chunks when 50% likely to be needed
  });

  private componentCache = new Map<string, any>();
  private preloadedChunks = new Set<string>();
  private loadingChunks = new Set<string>();

  constructor() {
    this.initializePerformanceMonitoring();
    this.setupLazyLoading();
    this.setupResourceHints();
  }

  // Performance Monitoring
  private initializePerformanceMonitoring(): void {
    if (typeof window === "undefined") return;

    // Monitor initial load performance
    window.addEventListener("load", () => {
      this.collectLoadMetrics();
    });

    // Monitor memory usage
    this.startMemoryMonitoring();

    // Monitor render performance
    this.setupRenderMetrics();
  }

  private collectLoadMetrics(): void {
    if (!performance || !performance.timing) return;

    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;

    this.metrics.value.loadTime = loadTime;

    // Get resource count
    const resources = performance.getEntriesByType("resource");
    this.metrics.value.resourceCount = resources.length;

    // Estimate bundle size from transferred bytes
    let totalSize = 0;
    resources.forEach((resource: any) => {
      if (resource.transferSize) {
        totalSize += resource.transferSize;
      }
    });
    this.metrics.value.bundleSize = totalSize;
  }

  private startMemoryMonitoring(): void {
    if (!(performance as any).memory) return;

    const updateMemory = () => {
      const memory = (performance as any).memory;
      this.metrics.value.memoryUsage = memory.usedJSHeapSize;
    };

    updateMemory();
    setInterval(updateMemory, 30000); // Update every 30 seconds
  }

  private setupRenderMetrics(): void {
    if (!window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (
          entry.entryType === "measure" &&
          entry.name.includes("vue-render")
        ) {
          this.metrics.value.renderTime = entry.duration;
        }
      });
    });

    observer.observe({ entryTypes: ["measure"] });
  }

  // Lazy Loading Implementation
  private setupLazyLoading(): void {
    if (!this.config.value.enableLazyLoading) return;

    this.setupIntersectionObserver();
    this.setupComponentLazyLoading();
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const lazyComponent = element.getAttribute("data-lazy-component");

            if (lazyComponent && !this.componentCache.has(lazyComponent)) {
              this.loadComponent(lazyComponent);
            }
          }
        });
      },
      { rootMargin: "50px" },
    );

    // Observe elements with data-lazy-component attribute
    document.addEventListener("DOMContentLoaded", () => {
      const lazyElements = document.querySelectorAll("[data-lazy-component]");
      lazyElements.forEach((element) => observer.observe(element));
    });
  }

  private setupComponentLazyLoading(): void {
    // Create a Vue plugin for lazy component loading
    const lazyComponentPlugin = {
      install: (app: any) => {
        app.directive("lazy-component", {
          mounted: (el: HTMLElement, binding: any) => {
            el.setAttribute("data-lazy-component", binding.value);
          },
        });
      },
    };

    // Store plugin reference for use in main.ts
    (window as any).__lazyComponentPlugin = lazyComponentPlugin;
  }

  // Resource Hints and Preloading
  private setupResourceHints(): void {
    if (!this.config.value.enableResourceHints) return;

    this.addDNSPrefetch();
    this.setupChunkPreloading();
  }

  private addDNSPrefetch(): void {
    const domains = [
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      // Add your API domains here
    ];

    domains.forEach((domain) => {
      const link = document.createElement("link");
      link.rel = "dns-prefetch";
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });
  }

  private setupChunkPreloading(): void {
    // Preload chunks based on user behavior patterns
    this.predictAndPreloadChunks();

    // Preload critical route chunks
    this.preloadCriticalChunks();
  }

  private predictAndPreloadChunks(): void {
    // Simple prediction based on current route
    const currentRoute = window.location.pathname;

    const routePredictions: Record<string, string[]> = {
      "/login": ["kitchen-dashboard", "settings"],
      "/kitchen": ["statistics", "audio-controls", "shortcuts"],
      "/settings": ["audio-system", "ui-components"],
    };

    const predictedChunks = routePredictions[currentRoute] || [];
    predictedChunks.forEach((chunk) => this.preloadChunk(chunk));
  }

  private preloadCriticalChunks(): void {
    const criticalChunks = ["vue-core", "vue-ecosystem", "ui-components"];

    criticalChunks.forEach((chunk) => this.preloadChunk(chunk));
  }

  private preloadChunk(chunkName: string): void {
    if (
      this.preloadedChunks.has(chunkName) ||
      this.loadingChunks.has(chunkName)
    ) {
      return;
    }

    this.loadingChunks.add(chunkName);

    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = `/assets/${chunkName}-[hash].js`; // Will be resolved by Vite
    link.onload = () => {
      this.preloadedChunks.add(chunkName);
      this.loadingChunks.delete(chunkName);
    };
    link.onerror = () => {
      this.loadingChunks.delete(chunkName);
    };

    document.head.appendChild(link);
  }

  // Component Cache Management
  async loadComponent(componentPath: string): Promise<any> {
    if (this.componentCache.has(componentPath)) {
      return this.componentCache.get(componentPath);
    }

    try {
      const component = await import(/* @vite-ignore */ componentPath);

      if (this.config.value.enableComponentCache) {
        this.componentCache.set(componentPath, component);
      }

      return component;
    } catch (error) {
      console.error(`Failed to load component: ${componentPath}`, error);
      throw error;
    }
  }

  // Image Optimization
  setupImageOptimization(): void {
    if (!this.config.value.enableImageOptimization) return;

    // Add intersection observer for lazy image loading
    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.getAttribute("data-src");

            if (src) {
              img.src = src;
              img.removeAttribute("data-src");
              imageObserver.unobserve(img);
            }
          }
        });
      },
      { rootMargin: "50px" },
    );

    // Observe all images with data-src
    document.addEventListener("DOMContentLoaded", () => {
      const lazyImages = document.querySelectorAll("img[data-src]");
      lazyImages.forEach((img) => imageObserver.observe(img));
    });
  }

  // Service Worker Registration
  async registerServiceWorker(): Promise<void> {
    if (
      !this.config.value.enableServiceWorker ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  }

  // Bundle Analysis
  analyzeBundlePerformance(): {
    score: number;
    recommendations: string[];
    metrics: PerformanceMetrics;
  } {
    const metrics = this.metrics.value;
    const recommendations: string[] = [];
    let score = 100;

    // Bundle size analysis
    if (metrics.bundleSize > 1024 * 1024) {
      // 1MB
      score -= 20;
      recommendations.push("考慮進一步分割代碼包，當前大小超過 1MB");
    }

    // Load time analysis
    if (metrics.loadTime > 3000) {
      // 3 seconds
      score -= 25;
      recommendations.push("加載時間過長，建議優化關鍵資源載入");
    }

    // Memory usage analysis
    if (metrics.memoryUsage > 50 * 1024 * 1024) {
      // 50MB
      score -= 15;
      recommendations.push("內存使用過高，考慮清理未使用的組件");
    }

    // Resource count analysis
    if (metrics.resourceCount > 100) {
      score -= 10;
      recommendations.push("資源文件過多，考慮合併或延遲載入");
    }

    // Render time analysis
    if (metrics.renderTime > 16) {
      // 60fps threshold
      score -= 10;
      recommendations.push("渲染時間過長，優化組件渲染邏輯");
    }

    return {
      score: Math.max(0, score),
      recommendations,
      metrics,
    };
  }

  // Configuration Management
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config.value = { ...this.config.value, ...newConfig };
    localStorage.setItem(
      "performance-config",
      JSON.stringify(this.config.value),
    );
  }

  // Getters
  get performanceMetrics() {
    return computed(() => this.metrics.value);
  }

  get optimizationConfig() {
    return computed(() => this.config.value);
  }

  get cacheStats() {
    return computed(() => ({
      componentsCached: this.componentCache.size,
      preloadedChunks: this.preloadedChunks.size,
      loadingChunks: this.loadingChunks.size,
    }));
  }
}

export const performanceOptimizationService =
  new PerformanceOptimizationService();
export type { PerformanceMetrics, OptimizationConfig };
