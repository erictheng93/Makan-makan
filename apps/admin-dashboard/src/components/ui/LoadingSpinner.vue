<template>
  <div class="loading-spinner" :class="spinnerClasses">
    <!-- Spinner SVG -->
    <svg
      class="spinner-svg"
      :class="sizeClasses"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="spinner-track"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="spinner-path"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- Loading text (optional) -->
    <span v-if="showText" class="spinner-text" :class="textClasses">
      {{ text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Props
interface Props {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?:
    | "primary"
    | "secondary"
    | "white"
    | "gray"
    | "success"
    | "error"
    | "warning";
  text?: string;
  showText?: boolean;
  center?: boolean;
  overlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  color: "primary",
  text: "載入中...",
  showText: false,
  center: false,
  overlay: false,
});

// Computed classes
const spinnerClasses = computed(() => {
  const classes = [];

  if (props.center) {
    classes.push("spinner-center");
  }

  if (props.overlay) {
    classes.push("spinner-overlay");
  }

  if (props.showText) {
    classes.push("spinner-with-text");
  }

  return classes;
});

const sizeClasses = computed(() => {
  const sizeMap = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };
  return sizeMap[props.size];
});

const textClasses = computed(() => {
  const colorMap = {
    primary: "text-blue-600",
    secondary: "text-gray-600",
    white: "text-white",
    gray: "text-gray-500",
    success: "text-green-600",
    error: "text-red-600",
    warning: "text-yellow-600",
  };

  const sizeMap = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  return [colorMap[props.color], sizeMap[props.size]];
});
</script>

<style scoped>
/* Base spinner styles */
.loading-spinner {
  @apply inline-flex items-center justify-center;
}

.spinner-svg {
  @apply animate-spin;
}

.spinner-track {
  @apply opacity-25;
}

.spinner-path {
  @apply opacity-75;
}

/* Color variants */
.loading-spinner {
  color: theme("colors.blue.600");
}

.loading-spinner[data-color="secondary"] {
  color: theme("colors.gray.600");
}

.loading-spinner[data-color="white"] {
  color: theme("colors.white");
}

.loading-spinner[data-color="gray"] {
  color: theme("colors.gray.500");
}

.loading-spinner[data-color="success"] {
  color: theme("colors.green.600");
}

.loading-spinner[data-color="error"] {
  color: theme("colors.red.600");
}

.loading-spinner[data-color="warning"] {
  color: theme("colors.yellow.600");
}

/* Layout variants */
.spinner-center {
  @apply flex items-center justify-center w-full h-full;
}

.spinner-overlay {
  @apply fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50;
}

.spinner-with-text {
  @apply flex-col space-y-2;
}

.spinner-with-text .spinner-svg {
  @apply mx-auto;
}

.spinner-text {
  @apply font-medium text-center;
}

/* Responsive text sizing */
@media (max-width: 640px) {
  .spinner-text {
    @apply text-sm;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .spinner-svg {
    @apply animate-none;
  }

  /* Use a pulsing animation instead for reduced motion */
  .spinner-svg {
    @apply animate-pulse;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .spinner-track {
    @apply opacity-50;
  }

  .spinner-path {
    @apply opacity-100;
  }
}

/* Print styles - hide spinner */
@media print {
  .loading-spinner {
    @apply hidden;
  }
}

/* Dark mode variants */
@media (prefers-color-scheme: dark) {
  .spinner-overlay {
    @apply bg-gray-900 bg-opacity-75;
  }
}

/* Focus visible for accessibility when used as button content */
.loading-spinner:focus-visible {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2 rounded;
}

/* Animation variants */
.loading-spinner.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Alternative spinner styles */
.loading-spinner.dots {
  @apply space-x-1;
}

.loading-spinner.dots .spinner-svg {
  @apply hidden;
}

.loading-spinner.dots::before {
  content: "";
  @apply inline-block w-2 h-2 bg-current rounded-full animate-pulse;
  animation-delay: 0s;
}

.loading-spinner.dots::after {
  content: "";
  @apply inline-block w-2 h-2 bg-current rounded-full animate-pulse ml-1;
  animation-delay: 0.2s;
}

/* Pulse variant */
.loading-spinner.pulse .spinner-svg {
  @apply animate-pulse;
}

.loading-spinner.pulse .spinner-track,
.loading-spinner.pulse .spinner-path {
  @apply opacity-100;
}
</style>
