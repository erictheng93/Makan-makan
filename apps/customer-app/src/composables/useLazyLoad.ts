/**
 * Lazy Loading Composable
 *
 * Provides utilities for lazy loading images and components
 * with Intersection Observer API
 */

import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

export interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number | number[];
  root?: Element | null;
  once?: boolean; // Disconnect after first intersection
}

export interface LazyLoadReturn {
  isIntersecting: Ref<boolean>;
  hasIntersected: Ref<boolean>;
  observedElement: Ref<Element | null>;
}

/**
 * Use Intersection Observer for lazy loading
 */
export function useLazyLoad(
  targetRef: Ref<Element | null>,
  options: LazyLoadOptions = {},
): LazyLoadReturn {
  const {
    rootMargin = "100px",
    threshold = 0.01,
    root = null,
    once = true,
  } = options;

  const isIntersecting = ref(false);
  const hasIntersected = ref(false);
  const observedElement = ref<Element | null>(null);
  let observer: IntersectionObserver | null = null;

  const setupObserver = () => {
    if (!targetRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isIntersecting.value = entry.isIntersecting;

          if (entry.isIntersecting) {
            hasIntersected.value = true;

            if (once) {
              observer?.disconnect();
            }
          }
        });
      },
      {
        root,
        rootMargin,
        threshold,
      },
    );

    observer.observe(targetRef.value);
    observedElement.value = targetRef.value;
  };

  onMounted(() => {
    setupObserver();
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return {
    isIntersecting,
    hasIntersected,
    observedElement,
  };
}

/**
 * Preload images in the background
 */
export function useImagePreload() {
  const preloadedImages = new Set<string>();
  const loadingImages = new Map<string, Promise<void>>();

  const preload = async (src: string): Promise<void> => {
    if (preloadedImages.has(src)) {
      return Promise.resolve();
    }

    if (loadingImages.has(src)) {
      return loadingImages.get(src)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        preloadedImages.add(src);
        loadingImages.delete(src);
        resolve();
      };
      img.onerror = () => {
        loadingImages.delete(src);
        reject(new Error(`Failed to preload image: ${src}`));
      };
      img.src = src;
    });

    loadingImages.set(src, promise);
    return promise;
  };

  const preloadMultiple = async (sources: string[]): Promise<void[]> => {
    return Promise.all(sources.map((src) => preload(src)));
  };

  const isPreloaded = (src: string): boolean => {
    return preloadedImages.has(src);
  };

  const clear = (): void => {
    preloadedImages.clear();
    loadingImages.clear();
  };

  return {
    preload,
    preloadMultiple,
    isPreloaded,
    clear,
  };
}

/**
 * Generate responsive image URLs for different sizes
 */
export function useResponsiveImage() {
  /**
   * Generate srcset for responsive images
   * Assumes Cloudflare Images or similar CDN
   */
  const generateSrcset = (
    baseUrl: string,
    sizes: number[] = [320, 640, 960, 1280, 1920],
  ): string => {
    return sizes
      .map((size) => {
        const url = transformImageUrl(baseUrl, { width: size });
        return `${url} ${size}w`;
      })
      .join(", ");
  };

  /**
   * Transform image URL with CDN parameters
   */
  const transformImageUrl = (
    url: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: "auto" | "webp" | "avif" | "jpeg" | "png";
      fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
    } = {},
  ): string => {
    const {
      width,
      height,
      quality = 85,
      format = "auto",
      fit = "scale-down",
    } = options;

    // Check if it's a Cloudflare Images URL
    if (url.includes("imagedelivery.net")) {
      // Cloudflare Images format: /cdn-cgi/imagedelivery/{account_hash}/{id}/{variant}
      const parts = url.split("/");
      const baseUrl = parts.slice(0, -1).join("/");

      const params: string[] = [];
      if (width) params.push(`w=${width}`);
      if (height) params.push(`h=${height}`);
      if (quality) params.push(`q=${quality}`);
      if (format) params.push(`f=${format}`);
      if (fit) params.push(`fit=${fit}`);

      const variant = params.length > 0 ? params.join(",") : "public";
      return `${baseUrl}/${variant}`;
    }

    // For other CDNs, return original URL
    // You can add other CDN transformations here
    return url;
  };

  /**
   * Get optimal image size based on viewport width
   */
  const getOptimalSize = (
    viewportWidth: number = window.innerWidth,
  ): number => {
    if (viewportWidth <= 640) return 640;
    if (viewportWidth <= 768) return 768;
    if (viewportWidth <= 1024) return 1024;
    if (viewportWidth <= 1280) return 1280;
    return 1920;
  };

  /**
   * Generate sizes attribute for responsive images
   */
  const generateSizes = (
    breakpoints: Record<string, string> = {
      "640px": "100vw",
      "768px": "50vw",
      "1024px": "33vw",
      "1280px": "25vw",
    },
  ): string => {
    const sizeEntries = Object.entries(breakpoints)
      .map(([bp, size]) => `(max-width: ${bp}) ${size}`)
      .join(", ");

    return `${sizeEntries}, 25vw`;
  };

  return {
    generateSrcset,
    transformImageUrl,
    getOptimalSize,
    generateSizes,
  };
}

/**
 * Detect image format support
 */
export function useImageFormatDetection() {
  const supportsWebP = ref<boolean | null>(null);
  const supportsAVIF = ref<boolean | null>(null);

  const detectWebP = async (): Promise<boolean> => {
    if (supportsWebP.value !== null) {
      return supportsWebP.value;
    }

    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        supportsWebP.value = webP.height === 2;
        resolve(supportsWebP.value);
      };
      webP.src =
        "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
    });
  };

  const detectAVIF = async (): Promise<boolean> => {
    if (supportsAVIF.value !== null) {
      return supportsAVIF.value;
    }

    return new Promise((resolve) => {
      const avif = new Image();
      avif.onload = avif.onerror = () => {
        supportsAVIF.value = avif.height === 2;
        resolve(supportsAVIF.value);
      };
      avif.src =
        "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=";
    });
  };

  const getBestFormat = async (): Promise<"avif" | "webp" | "jpeg"> => {
    const [avif, webp] = await Promise.all([detectAVIF(), detectWebP()]);

    if (avif) return "avif";
    if (webp) return "webp";
    return "jpeg";
  };

  onMounted(async () => {
    await Promise.all([detectWebP(), detectAVIF()]);
  });

  return {
    supportsWebP,
    supportsAVIF,
    getBestFormat,
  };
}
