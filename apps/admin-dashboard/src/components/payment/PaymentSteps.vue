<template>
  <div class="payment-steps">
    <nav class="steps-container" aria-label="Payment progress">
      <ol class="steps-list">
        <li
          v-for="(step, index) in steps"
          :key="step.key"
          class="step-item"
          :class="{
            'step-completed': isStepCompleted(index),
            'step-current': isStepCurrent(index),
            'step-pending': isStepPending(index),
          }"
        >
          <!-- Step connector line -->
          <div
            v-if="index < steps.length - 1"
            class="step-connector"
            :class="{
              'connector-completed': isStepCompleted(index),
              'connector-pending': !isStepCompleted(index),
            }"
          />

          <!-- Step circle with icon -->
          <div class="step-circle">
            <!-- Completed state: checkmark -->
            <div
              v-if="isStepCompleted(index)"
              class="step-icon step-icon-completed"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>

            <!-- Current state: step number with pulse -->
            <div
              v-else-if="isStepCurrent(index)"
              class="step-icon step-icon-current"
            >
              <span class="step-number">{{ index + 1 }}</span>
              <div class="step-pulse"></div>
            </div>

            <!-- Pending state: step number -->
            <div v-else class="step-icon step-icon-pending">
              <span class="step-number">{{ index + 1 }}</span>
            </div>
          </div>

          <!-- Step content -->
          <div class="step-content">
            <h3 class="step-title">{{ step.label }}</h3>
            <p v-if="step.description" class="step-description">
              {{ step.description }}
            </p>
          </div>
        </li>
      </ol>
    </nav>

    <!-- Progress bar (mobile) -->
    <div class="progress-bar-mobile md:hidden">
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: `${progressPercentage}%` }"
        />
      </div>
      <div class="progress-text">
        步驟 {{ currentStepIndex + 1 }} / {{ steps.length }}:
        {{ currentStep?.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Types
interface PaymentStep {
  key: string;
  label: string;
  description?: string;
  icon?: string;
}

// Props
interface Props {
  currentStep: string;
  steps: PaymentStep[];
  showDescriptions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showDescriptions: true,
});

// Computed properties
const currentStepIndex = computed(() =>
  props.steps.findIndex((step) => step.key === props.currentStep),
);

const currentStep = computed(() => props.steps[currentStepIndex.value]);

const progressPercentage = computed(() => {
  if (props.steps.length === 0) return 0;
  return Math.round(((currentStepIndex.value + 1) / props.steps.length) * 100);
});

// Step state helpers
const isStepCompleted = (index: number): boolean => {
  return index < currentStepIndex.value;
};

const isStepCurrent = (index: number): boolean => {
  return index === currentStepIndex.value;
};

const isStepPending = (index: number): boolean => {
  return index > currentStepIndex.value;
};
</script>

<style scoped>
/* Main container */
.payment-steps {
  @apply w-full;
}

.steps-container {
  @apply hidden md:block;
}

.steps-list {
  @apply flex items-start justify-between max-w-4xl mx-auto relative;
}

/* Step item */
.step-item {
  @apply flex flex-col items-center text-center relative flex-1 min-w-0;
}

.step-item:not(:last-child) {
  @apply pr-8;
}

/* Step connector */
.step-connector {
  @apply absolute top-6 left-1/2 w-full h-0.5 -z-10;
  transform: translateX(50%);
}

.connector-completed {
  @apply bg-gradient-to-r from-green-500 to-blue-500;
}

.connector-pending {
  @apply bg-gray-200;
}

/* Step circle */
.step-circle {
  @apply relative mb-4 flex-shrink-0;
}

.step-icon {
  @apply w-12 h-12 rounded-full border-2 flex items-center justify-center 
         font-semibold text-sm transition-all duration-300 relative;
}

.step-icon-completed {
  @apply bg-gradient-to-r from-green-500 to-green-600 text-white 
         border-green-500 shadow-lg shadow-green-200;
}

.step-icon-current {
  @apply bg-gradient-to-r from-blue-500 to-blue-600 text-white 
         border-blue-500 shadow-lg shadow-blue-200;
}

.step-icon-pending {
  @apply bg-white text-gray-400 border-gray-200 hover:border-gray-300
         transition-colors duration-200;
}

.step-number {
  @apply relative z-10;
}

/* Pulse animation for current step */
.step-pulse {
  @apply absolute inset-0 rounded-full bg-blue-400 opacity-20
         animate-ping;
}

/* Step content */
.step-content {
  @apply space-y-1 min-h-[3rem] flex flex-col justify-start;
}

.step-title {
  @apply text-sm font-medium transition-colors duration-200;
}

.step-completed .step-title {
  @apply text-green-700;
}

.step-current .step-title {
  @apply text-blue-700;
}

.step-pending .step-title {
  @apply text-gray-500;
}

.step-description {
  @apply text-xs text-gray-500 max-w-[120px] mx-auto leading-tight;
}

.step-current .step-description {
  @apply text-gray-600;
}

/* Mobile progress bar */
.progress-bar-mobile {
  @apply space-y-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm;
}

.progress-track {
  @apply w-full h-2 bg-gray-100 rounded-full overflow-hidden;
}

.progress-fill {
  @apply h-full bg-gradient-to-r from-blue-500 to-blue-600 
         transition-all duration-500 ease-out rounded-full;
}

.progress-text {
  @apply text-sm font-medium text-gray-700 text-center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .step-item:not(:last-child) {
    @apply pr-4;
  }

  .step-icon {
    @apply w-8 h-8 text-xs;
  }

  .step-title {
    @apply text-xs;
  }

  .step-description {
    @apply hidden;
  }

  .step-content {
    @apply min-h-[2rem];
  }
}

@media (max-width: 640px) {
  .steps-container {
    @apply hidden;
  }
}

/* Enhanced animations */
.step-icon-completed {
  animation: bounce-in 0.6s ease-out;
}

@keyframes bounce-in {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.step-icon-current {
  animation: scale-in 0.3s ease-out;
}

@keyframes scale-in {
  0% {
    transform: scale(0.8);
  }
  100% {
    transform: scale(1);
  }
}

/* Accessibility improvements */
.step-item[aria-current="step"] .step-circle {
  @apply ring-2 ring-blue-300 ring-offset-2;
}

/* Hover effects for non-mobile */
@media (hover: hover) {
  .step-pending .step-icon:hover {
    @apply border-gray-400 bg-gray-50;
  }

  .step-pending .step-title {
    @apply hover:text-gray-600;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .step-icon-completed {
    @apply bg-green-700 border-green-700;
  }

  .step-icon-current {
    @apply bg-blue-700 border-blue-700;
  }

  .step-connector {
    @apply h-1;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .step-pulse,
  .progress-fill {
    @apply animate-none transition-none;
  }

  .step-icon-completed,
  .step-icon-current {
    @apply animate-none;
  }
}
</style>
