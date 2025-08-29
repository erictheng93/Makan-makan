interface ImageMetadata {
  src: string
  alt?: string
  width?: number
  height?: number
  quality?: number
  progressive?: boolean
  placeholder?: string
}

interface LazyLoadingConfig {
  // Intersection Observer options
  rootMargin: string
  threshold: number
  
  // Loading strategy
  strategy: 'eager' | 'lazy' | 'progressive' | 'adaptive'
  
  // Image optimization
  defaultQuality: number
  enableProgressive: boolean
  enableWebP: boolean
  enableAVIF: boolean
  
  // Performance settings
  maxConcurrentLoads: number
  preloadCount: number
  
  // Retry settings
  maxRetries: number
  retryDelay: number
  
  // Cache settings
  enableCache: boolean
  cacheSize: number
}

interface LoadingQueue {
  images: ImageMetadata[]
  loading: Set<string>
  loaded: Set<string>
  failed: Set<string>
}

export class LazyLoadingService {
  private config: LazyLoadingConfig
  private queue: LoadingQueue
  private cache: Map<string, HTMLImageElement>
  private observers: Map<string, IntersectionObserver>
  private loadingPromises: Map<string, Promise<HTMLImageElement>>
  
  constructor(config?: Partial<LazyLoadingConfig>) {
    this.config = {
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
      ...config
    }
    
    this.queue = {
      images: [],
      loading: new Set(),
      loaded: new Set(),
      failed: new Set()
    }
    
    this.cache = new Map()
    this.observers = new Map()
    this.loadingPromises = new Map()
    
    // Initialize performance monitoring
    this.initPerformanceMonitoring()
  }
  
  /**
   * Initialize performance monitoring for adaptive loading
   */
  private initPerformanceMonitoring(): void {
    // Monitor network connection
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      
      if (connection) {
        // Adjust strategy based on connection speed
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          this.config.strategy = 'lazy'
          this.config.defaultQuality = 60
          this.config.maxConcurrentLoads = 2
        } else if (connection.effectiveType === '3g') {
          this.config.strategy = 'progressive'
          this.config.defaultQuality = 75
          this.config.maxConcurrentLoads = 4
        }
        
        // Listen for connection changes
        connection.addEventListener('change', () => {
          this.adaptToNetworkConditions()
        })
      }
    }
    
    // Monitor device memory (if available)
    if ('deviceMemory' in navigator) {
      const deviceMemory = (navigator as any).deviceMemory
      
      if (deviceMemory && deviceMemory < 4) {
        // Reduce cache size and concurrent loads for low-memory devices
        this.config.cacheSize = Math.min(this.config.cacheSize, 50)
        this.config.maxConcurrentLoads = Math.min(this.config.maxConcurrentLoads, 3)
      }
    }
  }
  
  /**
   * Adapt loading strategy based on current network conditions
   */
  private adaptToNetworkConditions(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      const rtt = connection.rtt || 0
      const downlink = connection.downlink || 0
      
      // Adjust quality based on connection speed
      if (downlink < 0.5) {
        this.config.defaultQuality = 60
      } else if (downlink < 1.5) {
        this.config.defaultQuality = 75
      } else {
        this.config.defaultQuality = 85
      }
      
      // Adjust concurrent loads based on RTT
      if (rtt > 2000) {
        this.config.maxConcurrentLoads = 2
      } else if (rtt > 1000) {
        this.config.maxConcurrentLoads = 4
      } else {
        this.config.maxConcurrentLoads = 6
      }
    }
  }
  
  /**
   * Process image URL with optimization parameters
   */
  private processImageUrl(src: string, options?: Partial<ImageMetadata>): string {
    if (!src) return src
    
    // Handle Cloudflare Images URLs
    if (src.includes('imagedelivery.net') || src.includes('images.cloudflare.com')) {
      const url = new URL(src)
      
      // Add quality parameter
      const quality = options?.quality || this.config.defaultQuality
      url.searchParams.set('quality', quality.toString())
      
      // Add format parameter for progressive enhancement
      if (this.config.enableProgressive) {
        if (this.config.enableAVIF && this.supportsFormat('avif')) {
          url.searchParams.set('format', 'avif')
        } else if (this.config.enableWebP && this.supportsFormat('webp')) {
          url.searchParams.set('format', 'webp')
        } else {
          url.searchParams.set('format', 'auto')
        }
      }
      
      // Add dimensions if specified
      if (options?.width && options?.height) {
        url.searchParams.set('width', options.width.toString())
        url.searchParams.set('height', options.height.toString())
        url.searchParams.set('fit', 'cover')
      }
      
      return url.toString()
    }
    
    return src
  }
  
  /**
   * Check if browser supports image format
   */
  private supportsFormat(format: string): boolean {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    
    const formats: Record<string, string> = {
      webp: 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA',
      avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg=='
    }
    
    return canvas.toDataURL(formats[format]).indexOf(formats[format]) === 5
  }
  
  /**
   * Load image with caching and retry logic
   */
  async loadImage(metadata: ImageMetadata): Promise<HTMLImageElement> {
    const processedSrc = this.processImageUrl(metadata.src, metadata)
    
    // Check cache first
    if (this.config.enableCache && this.cache.has(processedSrc)) {
      const cachedImage = this.cache.get(processedSrc)!
      return Promise.resolve(cachedImage.cloneNode(true) as HTMLImageElement)
    }
    
    // Check if already loading
    if (this.loadingPromises.has(processedSrc)) {
      return this.loadingPromises.get(processedSrc)!
    }
    
    // Create loading promise
    const loadingPromise = this.createLoadingPromise(processedSrc, metadata)
    this.loadingPromises.set(processedSrc, loadingPromise)
    
    try {
      const image = await loadingPromise
      
      // Cache successful loads
      if (this.config.enableCache) {
        this.addToCache(processedSrc, image)
      }
      
      this.queue.loaded.add(processedSrc)
      return image
    } catch (error) {
      this.queue.failed.add(processedSrc)
      throw error
    } finally {
      this.loadingPromises.delete(processedSrc)
      this.queue.loading.delete(processedSrc)
    }
  }
  
  /**
   * Create promise for loading image with retry logic
   */
  private createLoadingPromise(src: string, metadata: ImageMetadata): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      let retryCount = 0
      
      const attemptLoad = () => {
        const img = new Image()
        
        img.onload = () => {
          resolve(img)
        }
        
        img.onerror = () => {
          retryCount++
          
          if (retryCount <= this.config.maxRetries) {
            // Exponential backoff
            const delay = this.config.retryDelay * Math.pow(2, retryCount - 1)
            setTimeout(attemptLoad, delay)
          } else {
            reject(new Error(`Failed to load image after ${this.config.maxRetries} retries: ${src}`))
          }
        }
        
        // Set attributes
        if (metadata.alt) img.alt = metadata.alt
        if (metadata.width) img.width = metadata.width
        if (metadata.height) img.height = metadata.height
        
        // Start loading
        img.src = src
      }
      
      this.queue.loading.add(src)
      attemptLoad()
    })
  }
  
  /**
   * Add image to cache with LRU eviction
   */
  private addToCache(src: string, image: HTMLImageElement): void {
    if (this.cache.size >= this.config.cacheSize) {
      // Remove oldest entry (simple FIFO, could be improved with proper LRU)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(src, image.cloneNode(true) as HTMLImageElement)
  }
  
  /**
   * Preload critical images
   */
  async preloadCritical(images: ImageMetadata[]): Promise<void> {
    const criticalImages = images.slice(0, this.config.preloadCount)
    
    const loadPromises = criticalImages.map(async (metadata) => {
      try {
        await this.loadImage(metadata)
      } catch (error) {
        console.warn('Failed to preload critical image:', metadata.src, error)
      }
    })
    
    await Promise.allSettled(loadPromises)
  }
  
  /**
   * Create intersection observer for lazy loading
   */
  createObserver(
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    const observerOptions = {
      root: null,
      rootMargin: this.config.rootMargin,
      threshold: this.config.threshold,
      ...options
    }
    
    return new IntersectionObserver(callback, observerOptions)
  }
  
  /**
   * Get loading statistics
   */
  getStats(): {
    totalImages: number
    loadedImages: number
    failedImages: number
    loadingImages: number
    cacheSize: number
    hitRate: number
  } {
    const totalImages = this.queue.images.length
    const loadedImages = this.queue.loaded.size
    const failedImages = this.queue.failed.size
    const loadingImages = this.queue.loading.size
    const cacheSize = this.cache.size
    const hitRate = totalImages > 0 ? loadedImages / totalImages : 0
    
    return {
      totalImages,
      loadedImages,
      failedImages,
      loadingImages,
      cacheSize,
      hitRate
    }
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    this.queue.loaded.clear()
    this.queue.failed.clear()
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LazyLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.adaptToNetworkConditions()
  }
  
  /**
   * Dispose of service and clean up resources
   */
  dispose(): void {
    this.clearCache()
    this.loadingPromises.clear()
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }
}

// Create singleton instance
export const lazyLoadingService = new LazyLoadingService()

export default lazyLoadingService