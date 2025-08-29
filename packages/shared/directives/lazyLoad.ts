import type { DirectiveBinding, ObjectDirective } from 'vue'

interface LazyLoadOptions {
  src: string
  placeholder?: string
  rootMargin?: string
  threshold?: number
  loading?: 'eager' | 'lazy'
  quality?: number
  progressive?: boolean
  errorHandler?: (element: HTMLImageElement) => void
  loadHandler?: (element: HTMLImageElement) => void
}

interface LazyElement extends HTMLImageElement {
  _lazyObserver?: IntersectionObserver
  _lazyOptions?: LazyLoadOptions
  _lazyRetryCount?: number
}

const defaultOptions: Partial<LazyLoadOptions> = {
  placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0MCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjE2MCIgeT0iMTIwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+MzIweDI0MDwvdGV4dD48L3N2Zz4=',
  rootMargin: '50px',
  threshold: 0.1,
  loading: 'lazy',
  quality: 85,
  progressive: true
}

// Image processing for Cloudflare Images
const processImageUrl = (src: string, options: LazyLoadOptions): string => {
  if (!src) return src
  
  // Handle Cloudflare Images URLs
  if (src.includes('imagedelivery.net') || src.includes('images.cloudflare.com')) {
    const url = new URL(src)
    
    if (options.quality && options.quality !== 85) {
      url.searchParams.set('quality', options.quality.toString())
    }
    
    if (options.progressive) {
      url.searchParams.set('format', 'auto')
    }
    
    return url.toString()
  }
  
  return src
}

// Image loading with error handling and retry logic
const loadImage = (element: LazyElement, src: string, options: LazyLoadOptions): void => {
  const processedSrc = processImageUrl(src, options)
  
  // Show loading state
  element.classList.add('lazy-loading')
  
  const handleLoad = () => {
    element.classList.remove('lazy-loading', 'lazy-error')
    element.classList.add('lazy-loaded')
    element._lazyRetryCount = 0
    
    if (options.loadHandler) {
      options.loadHandler(element)
    }
  }
  
  const handleError = () => {
    element.classList.remove('lazy-loading')
    element.classList.add('lazy-error')
    
    // Retry logic
    const retryCount = element._lazyRetryCount || 0
    const maxRetries = 3
    
    if (retryCount < maxRetries) {
      element._lazyRetryCount = (element._lazyRetryCount || 0) + 1
      
      setTimeout(() => {
        element.src = processedSrc
      }, 1000 * Math.pow(2, retryCount)) // Exponential backoff
    } else {
      if (options.errorHandler) {
        options.errorHandler(element)
      }
    }
  }
  
  // Set up event listeners
  element.removeEventListener('load', handleLoad)
  element.removeEventListener('error', handleError)
  element.addEventListener('load', handleLoad, { once: true })
  element.addEventListener('error', handleError, { once: true })
  
  // Start loading
  element.src = processedSrc
}

// Intersection Observer callback
const observerCallback = (entries: IntersectionObserverEntry[]) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target as LazyElement
      const options = element._lazyOptions!
      
      // Remove from observer
      if (element._lazyObserver) {
        element._lazyObserver.unobserve(element)
      }
      
      // Start loading image
      loadImage(element, options.src, options)
    }
  })
}

// Create Intersection Observer
const createObserver = (options: LazyLoadOptions): IntersectionObserver => {
  const observerOptions = {
    root: null,
    rootMargin: options.rootMargin || defaultOptions.rootMargin!,
    threshold: options.threshold || defaultOptions.threshold!
  }
  
  return new IntersectionObserver(observerCallback, observerOptions)
}

// Main directive implementation
export const vLazyLoad: ObjectDirective<LazyElement, string | LazyLoadOptions> = {
  beforeMount(el: LazyElement, binding: DirectiveBinding<string | LazyLoadOptions>) {
    // Parse options
    let options: LazyLoadOptions
    
    if (typeof binding.value === 'string') {
      options = { ...defaultOptions, src: binding.value } as LazyLoadOptions
    } else {
      options = { ...defaultOptions, ...binding.value } as LazyLoadOptions
    }
    
    // Store options on element
    el._lazyOptions = options
    el._lazyRetryCount = 0
    
    // Set placeholder
    if (options.placeholder && !el.src) {
      el.src = options.placeholder
    }
    
    // Add CSS classes for styling
    el.classList.add('lazy-image')
    
    // Handle eager loading
    if (options.loading === 'eager') {
      loadImage(el, options.src, options)
      return
    }
    
    // Set up intersection observer for lazy loading
    const observer = createObserver(options)
    el._lazyObserver = observer
    observer.observe(el)
  },
  
  updated(el: LazyElement, binding: DirectiveBinding<string | LazyLoadOptions>) {
    let newOptions: LazyLoadOptions
    
    if (typeof binding.value === 'string') {
      newOptions = { ...defaultOptions, src: binding.value } as LazyLoadOptions
    } else {
      newOptions = { ...defaultOptions, ...binding.value } as LazyLoadOptions
    }
    
    // Check if src changed
    const oldOptions = el._lazyOptions
    if (oldOptions && oldOptions.src !== newOptions.src) {
      // Clean up old observer
      if (el._lazyObserver) {
        el._lazyObserver.unobserve(el)
      }
      
      // Reset state
      el.classList.remove('lazy-loaded', 'lazy-error', 'lazy-loading')
      el._lazyRetryCount = 0
      el._lazyOptions = newOptions
      
      // Set placeholder
      if (newOptions.placeholder) {
        el.src = newOptions.placeholder
      }
      
      // Handle eager loading or setup new observer
      if (newOptions.loading === 'eager') {
        loadImage(el, newOptions.src, newOptions)
      } else {
        const observer = createObserver(newOptions)
        el._lazyObserver = observer
        observer.observe(el)
      }
    }
  },
  
  beforeUnmount(el: LazyElement) {
    // Clean up observer
    if (el._lazyObserver) {
      el._lazyObserver.unobserve(el)
      el._lazyObserver.disconnect()
      delete el._lazyObserver
    }
    
    // Clean up options
    delete el._lazyOptions
    delete el._lazyRetryCount
  }
}

// Helper function to preload images
export const preloadImage = (src: string, options?: Partial<LazyLoadOptions>): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const finalOptions = { ...defaultOptions, ...options } as LazyLoadOptions
    const processedSrc = processImageUrl(src, finalOptions)
    
    img.onload = () => resolve(img)
    img.onerror = (error) => reject(error)
    img.src = processedSrc
  })
}

// Helper function to preload multiple images
export const preloadImages = async (
  sources: string[],
  options?: Partial<LazyLoadOptions>
): Promise<HTMLImageElement[]> => {
  const promises = sources.map(src => preloadImage(src, options))
  return Promise.all(promises)
}

// Hook for Vue composition API
export const useLazyLoad = () => {
  const preload = (src: string, options?: Partial<LazyLoadOptions>) => {
    return preloadImage(src, options)
  }
  
  const preloadMultiple = (sources: string[], options?: Partial<LazyLoadOptions>) => {
    return preloadImages(sources, options)
  }
  
  return {
    preload,
    preloadMultiple,
    vLazyLoad
  }
}

export default vLazyLoad