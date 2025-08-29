<template>
  <div
    ref="container"
    :class="containerClass"
    :style="containerStyle"
    class="lazy-image-container relative overflow-hidden"
  >
    <!-- Placeholder/Loading skeleton -->
    <div
      v-if="!imageLoaded && !imageError"
      class="absolute inset-0 flex items-center justify-center"
      :class="placeholderClass"
    >
      <!-- Custom loading slot -->
      <slot name="loading" v-if="$slots.loading"></slot>
      
      <!-- Default loading animation -->
      <div v-else class="flex flex-col items-center justify-center">
        <div 
          v-if="showLoadingSkeleton"
          class="animate-pulse bg-gray-300 rounded"
          :style="{ width: '100%', height: '100%' }"
        ></div>
        <div v-else class="flex items-center space-x-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
          <span class="text-sm text-gray-500">載入中...</span>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="imageError"
      class="absolute inset-0 flex items-center justify-center"
      :class="errorClass"
    >
      <!-- Custom error slot -->
      <slot name="error" v-if="$slots.error" :retry="retryLoad"></slot>
      
      <!-- Default error state -->
      <div v-else class="flex flex-col items-center justify-center text-gray-400">
        <svg class="w-12 h-12 mb-2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span class="text-sm text-center">載入失敗</span>
        <button
          @click="retryLoad"
          class="mt-2 px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 transition-colors"
        >
          重試
        </button>
      </div>
    </div>

    <!-- Actual image -->
    <img
      v-if="shouldLoadImage"
      :src="currentSrc"
      :alt="alt"
      :class="imageClass"
      :style="imageStyle"
      @load="handleLoad"
      @error="handleError"
      class="lazy-image transition-opacity duration-300"
      :style="{ opacity: imageLoaded ? 1 : 0 }"
    />

    <!-- Overlay slot -->
    <div v-if="$slots.overlay" class="absolute inset-0 pointer-events-none">
      <slot name="overlay"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface Props {
  src: string
  alt?: string
  placeholder?: string
  containerClass?: string
  imageClass?: string
  placeholderClass?: string
  errorClass?: string
  containerStyle?: Record<string, any>
  imageStyle?: Record<string, any>
  loadingDelay?: number
  retryDelay?: number
  maxRetries?: number
  showLoadingSkeleton?: boolean
  eager?: boolean
  rootMargin?: string
  threshold?: number
  sizes?: string
  srcset?: string
  quality?: number
  progressive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  placeholder: '',
  containerClass: '',
  imageClass: '',
  placeholderClass: 'bg-gray-100',
  errorClass: 'bg-gray-50',
  loadingDelay: 100,
  retryDelay: 1000,
  maxRetries: 3,
  showLoadingSkeleton: true,
  eager: false,
  rootMargin: '50px',
  threshold: 0.1,
  quality: 85,
  progressive: true
})

const emit = defineEmits<{
  'load': [event: Event]
  'error': [event: Event]
  'intersect': [entry: IntersectionObserverEntry]
}>()

// Refs
const container = ref<HTMLElement>()
const imageLoaded = ref(false)
const imageError = ref(false)
const shouldLoadImage = ref(props.eager)
const retryCount = ref(0)
const observer = ref<IntersectionObserver>()

// Computed
const currentSrc = computed(() => {
  if (!props.src) return ''
  
  // Add quality and progressive parameters if it's a Cloudflare Images URL
  if (props.src.includes('imagedelivery.net') || props.src.includes('images.cloudflare.com')) {
    const url = new URL(props.src)
    
    if (props.quality && props.quality !== 85) {
      url.searchParams.set('quality', props.quality.toString())
    }
    
    if (props.progressive) {
      url.searchParams.set('format', 'auto')
    }
    
    return url.toString()
  }
  
  return props.src
})

// Methods
const handleLoad = (event: Event) => {
  imageLoaded.value = true
  imageError.value = false
  emit('load', event)
}

const handleError = (event: Event) => {
  imageError.value = true
  imageLoaded.value = false
  emit('error', event)
  
  // Auto retry logic
  if (retryCount.value < props.maxRetries) {
    setTimeout(() => {
      retryLoad()
    }, props.retryDelay)
  }
}

const retryLoad = () => {
  if (retryCount.value >= props.maxRetries) return
  
  retryCount.value++
  imageError.value = false
  imageLoaded.value = false
  
  // Force reload by updating the src
  nextTick(() => {
    shouldLoadImage.value = false
    nextTick(() => {
      shouldLoadImage.value = true
    })
  })
}

const handleIntersection = (entries: IntersectionObserverEntry[]) => {
  const entry = entries[0]
  emit('intersect', entry)
  
  if (entry.isIntersecting && !shouldLoadImage.value) {
    // Add a small delay for better UX
    setTimeout(() => {
      shouldLoadImage.value = true
    }, props.loadingDelay)
    
    // Stop observing once we start loading
    if (observer.value && container.value) {
      observer.value.unobserve(container.value)
    }
  }
}

const setupIntersectionObserver = () => {
  if (!container.value || props.eager) return
  
  const options = {
    root: null,
    rootMargin: props.rootMargin,
    threshold: props.threshold
  }
  
  observer.value = new IntersectionObserver(handleIntersection, options)
  observer.value.observe(container.value)
}

// Watch for src changes
watch(() => props.src, (newSrc, oldSrc) => {
  if (newSrc !== oldSrc) {
    imageLoaded.value = false
    imageError.value = false
    retryCount.value = 0
    
    if (props.eager) {
      shouldLoadImage.value = true
    } else {
      shouldLoadImage.value = false
      setupIntersectionObserver()
    }
  }
})

// Lifecycle
onMounted(() => {
  if (!props.eager) {
    setupIntersectionObserver()
  }
})

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }
})

// Expose methods for parent components
defineExpose({
  retryLoad,
  container,
  imageLoaded: computed(() => imageLoaded.value),
  imageError: computed(() => imageError.value),
  shouldLoadImage: computed(() => shouldLoadImage.value)
})
</script>

<style scoped>
.lazy-image-container {
  background-color: #f8f9fa;
}

.lazy-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Pulse animation for loading skeleton */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Fade in animation */
.lazy-image {
  transition: opacity 0.3s ease-in-out;
}

/* Responsive images */
@media (max-width: 640px) {
  .lazy-image-container {
    min-height: 200px;
  }
}

@media (min-width: 641px) {
  .lazy-image-container {
    min-height: 300px;
  }
}
</style>