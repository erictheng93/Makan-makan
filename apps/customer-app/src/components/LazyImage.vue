<template>
  <div
    ref="containerRef"
    :class="[
      'lazy-image-container',
      { 'is-loading': isLoading, 'has-error': hasError },
    ]"
    :style="containerStyle"
  >
    <!-- Placeholder while loading -->
    <div v-if="isLoading && !hasError" class="lazy-image-placeholder">
      <div class="spinner"></div>
    </div>

    <!-- Error state -->
    <div v-if="hasError" class="lazy-image-error">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <p>{{ errorMessage }}</p>
    </div>

    <!-- Actual image -->
    <img
      v-show="!isLoading && !hasError"
      ref="imageRef"
      :src="currentSrc"
      :srcset="computedSrcset"
      :sizes="sizes"
      :alt="alt"
      :loading="nativeLoading ? 'lazy' : 'eager'"
      :class="['lazy-image', imageClass]"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";

interface Props {
  src: string;
  srcset?: string;
  sizes?: string;
  alt: string;
  aspectRatio?: string; // e.g., "16/9", "4/3", "1/1"
  placeholderColor?: string;
  errorMessage?: string;
  imageClass?: string;
  nativeLoading?: boolean; // Use native lazy loading
  rootMargin?: string; // Intersection Observer root margin
  threshold?: number; // Intersection Observer threshold
}

const props = withDefaults(defineProps<Props>(), {
  srcset: "",
  sizes: "",
  aspectRatio: "16/9",
  placeholderColor: "#f0f0f0",
  errorMessage: "Failed to load image",
  imageClass: "",
  nativeLoading: true,
  rootMargin: "100px",
  threshold: 0.01,
});

const emit = defineEmits<{
  load: [event: Event];
  error: [event: Event];
}>();

const containerRef = ref<HTMLDivElement>();
const imageRef = ref<HTMLImageElement>();
const isLoading = ref(true);
const hasError = ref(false);
const isIntersecting = ref(false);
const currentSrc = ref("");

const containerStyle = computed(() => ({
  aspectRatio: props.aspectRatio,
  backgroundColor: props.placeholderColor,
}));

const computedSrcset = computed(() => {
  if (!isIntersecting.value && !props.nativeLoading) return "";
  return props.srcset;
});

let observer: IntersectionObserver | null = null;

const setupIntersectionObserver = () => {
  if (!containerRef.value || props.nativeLoading) return;

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isIntersecting.value = true;
          loadImage();
          observer?.disconnect();
        }
      });
    },
    {
      rootMargin: props.rootMargin,
      threshold: props.threshold,
    },
  );

  observer.observe(containerRef.value);
};

const loadImage = () => {
  if (currentSrc.value || hasError.value) return;
  currentSrc.value = props.src;
};

const handleLoad = (event: Event) => {
  isLoading.value = false;
  hasError.value = false;
  emit("load", event);
};

const handleError = (event: Event) => {
  isLoading.value = false;
  hasError.value = true;
  emit("error", event);
};

watch(
  () => props.src,
  (newSrc) => {
    if (newSrc !== currentSrc.value) {
      isLoading.value = true;
      hasError.value = false;
      currentSrc.value = newSrc;
    }
  },
);

onMounted(() => {
  if (props.nativeLoading) {
    // Use native lazy loading - load immediately
    loadImage();
  } else {
    // Use Intersection Observer
    setupIntersectionObserver();
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<style scoped>
.lazy-image-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s ease-in-out;
}

.lazy-image-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.lazy-image-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  gap: 8px;
}

.lazy-image-error p {
  font-size: 12px;
  margin: 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive optimizations */
@media (prefers-reduced-motion: reduce) {
  .lazy-image,
  .spinner,
  .lazy-image-placeholder {
    animation: none;
    transition: none;
  }
}
</style>
