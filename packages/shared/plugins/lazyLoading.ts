import type { App } from 'vue'
import { vLazyLoad } from '../directives/lazyLoad'
import { lazyLoadingService } from '../services/lazyLoadingService'
import LazyImage from '../components/LazyImage.vue'

export interface LazyLoadingPluginOptions {
  // Service configuration
  rootMargin?: string
  threshold?: number
  strategy?: 'eager' | 'lazy' | 'progressive' | 'adaptive'
  defaultQuality?: number
  enableProgressive?: boolean
  enableWebP?: boolean
  enableAVIF?: boolean
  maxConcurrentLoads?: number
  preloadCount?: number
  maxRetries?: number
  retryDelay?: number
  enableCache?: boolean
  cacheSize?: number
  
  // Component options
  registerComponent?: boolean
  componentName?: string
  
  // Directive options
  registerDirective?: boolean
  directiveName?: string
  
  // Global styles
  injectStyles?: boolean
}

const defaultOptions: LazyLoadingPluginOptions = {
  // Service defaults
  rootMargin: '50px',
  threshold: 0.1,
  strategy: 'adaptive',
  defaultQuality: 85,
  enableProgressive: true,
  enableWebP: true,
  enableAVIF: false,
  maxConcurrentLoads: 6,
  preloadCount: 3,
  maxRetries: 3,
  retryDelay: 1000,
  enableCache: true,
  cacheSize: 100,
  
  // Plugin defaults
  registerComponent: true,
  componentName: 'LazyImage',
  registerDirective: true,
  directiveName: 'lazy',
  injectStyles: true
}

export default {
  install(app: App, options?: LazyLoadingPluginOptions) {
    const finalOptions = { ...defaultOptions, ...options }
    
    // Update lazy loading service configuration
    lazyLoadingService.updateConfig({
      rootMargin: finalOptions.rootMargin!,
      threshold: finalOptions.threshold!,
      strategy: finalOptions.strategy!,
      defaultQuality: finalOptions.defaultQuality!,
      enableProgressive: finalOptions.enableProgressive!,
      enableWebP: finalOptions.enableWebP!,
      enableAVIF: finalOptions.enableAVIF!,
      maxConcurrentLoads: finalOptions.maxConcurrentLoads!,
      preloadCount: finalOptions.preloadCount!,
      maxRetries: finalOptions.maxRetries!,
      retryDelay: finalOptions.retryDelay!,
      enableCache: finalOptions.enableCache!,
      cacheSize: finalOptions.cacheSize!
    })
    
    // Register LazyImage component
    if (finalOptions.registerComponent) {
      app.component(finalOptions.componentName!, LazyImage)
    }
    
    // Register v-lazy directive
    if (finalOptions.registerDirective) {
      app.directive(finalOptions.directiveName!, vLazyLoad)
    }
    
    // Provide lazy loading service globally
    app.provide('lazyLoadingService', lazyLoadingService)
    
    // Add global properties for easier access
    app.config.globalProperties.$lazyLoading = lazyLoadingService
    
    // Inject global styles
    if (finalOptions.injectStyles) {
      injectGlobalStyles()
    }
    
    // Preload critical images on app mount
    app.mixin({
      async mounted() {
        // Only run on root component
        if (this.$el === document.body.firstElementChild) {
          await this.preloadCriticalImages()
        }
      },
      
      methods: {
        async preloadCriticalImages() {
          // Look for images marked as critical
          const criticalImages = document.querySelectorAll('img[data-critical="true"]')
          const imageMetadata = Array.from(criticalImages).map(img => ({
            src: (img as HTMLImageElement).src,
            alt: (img as HTMLImageElement).alt,
            width: (img as HTMLImageElement).width,
            height: (img as HTMLImageElement).height
          }))
          
          if (imageMetadata.length > 0) {
            await lazyLoadingService.preloadCritical(imageMetadata)
          }
        }
      }
    })
    
    // Setup performance monitoring
    if (typeof window !== 'undefined') {
      setupPerformanceMonitoring()
    }
  }
}

/**
 * Inject global CSS styles for lazy loading
 */
function injectGlobalStyles(): void {
  if (typeof document === 'undefined') return
  
  const styleId = 'lazy-loading-global-styles'
  
  // Check if styles already injected
  if (document.getElementById(styleId)) return
  
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* Lazy loading base styles */
    .lazy-image {
      transition: opacity 0.3s ease-in-out, filter 0.3s ease-in-out;
      background-color: #f8f9fa;
    }
    
    .lazy-image.lazy-loading {
      opacity: 0.7;
      filter: blur(1px);
    }
    
    .lazy-image.lazy-loaded {
      opacity: 1;
      filter: none;
    }
    
    .lazy-image.lazy-error {
      opacity: 0.5;
      filter: grayscale(100%);
      background-color: #fee;
      position: relative;
    }
    
    .lazy-image.lazy-error::after {
      content: "⚠";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      color: #ef4444;
      pointer-events: none;
    }
    
    /* Loading skeleton animation */
    .lazy-skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
    }
    
    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    
    /* Responsive improvements */
    @media (prefers-reduced-motion: reduce) {
      .lazy-image,
      .lazy-skeleton {
        animation: none !important;
        transition: none !important;
      }
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .lazy-image.lazy-error {
        border: 2px solid red;
        background-color: transparent;
      }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .lazy-image {
        background-color: #1f2937;
      }
      
      .lazy-skeleton {
        background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
        background-size: 200% 100%;
      }
    }
  `
  
  document.head.appendChild(style)
}

/**
 * Setup performance monitoring and adaptive behavior
 */
function setupPerformanceMonitoring(): void {
  // Monitor page load performance
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      entries.forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          const lcp = entry.startTime
          
          // Adjust strategy based on LCP
          if (lcp > 4000) { // Poor LCP
            lazyLoadingService.updateConfig({
              strategy: 'lazy',
              defaultQuality: 70,
              maxConcurrentLoads: 3
            })
          } else if (lcp > 2500) { // Needs improvement
            lazyLoadingService.updateConfig({
              strategy: 'progressive',
              defaultQuality: 80,
              maxConcurrentLoads: 4
            })
          }
        }
        
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart
          
          // Adjust preload count based on load time
          if (loadTime > 3000) {
            lazyLoadingService.updateConfig({
              preloadCount: 2
            })
          } else if (loadTime < 1000) {
            lazyLoadingService.updateConfig({
              preloadCount: 5
            })
          }
        }
      })
    })
    
    observer.observe({ entryTypes: ['largest-contentful-paint', 'navigation'] })
  }
  
  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory
      const usedMemory = memory.usedJSHeapSize / memory.totalJSHeapSize
      
      // Reduce cache size if memory usage is high
      if (usedMemory > 0.8) {
        lazyLoadingService.updateConfig({
          cacheSize: Math.max(20, Math.floor(lazyLoadingService.getStats().cacheSize * 0.7))
        })
      }
    }, 30000) // Check every 30 seconds
  }
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Clear cache when page is hidden to free memory
      setTimeout(() => {
        if (document.visibilityState === 'hidden') {
          lazyLoadingService.clearCache()
        }
      }, 60000) // Clear after 1 minute
    }
  })
}

// Export composable for use in components
export const useLazyLoading = () => {
  return {
    service: lazyLoadingService,
    preload: lazyLoadingService.loadImage.bind(lazyLoadingService),
    getStats: lazyLoadingService.getStats.bind(lazyLoadingService),
    clearCache: lazyLoadingService.clearCache.bind(lazyLoadingService)
  }
}