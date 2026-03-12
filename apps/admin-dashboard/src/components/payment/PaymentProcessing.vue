<template>
  <div class="payment-processing">
    <!-- Processing State -->
    <div
      v-if="status === 'processing'"
      class="state-container processing-state"
    >
      <div class="state-icon">
        <div class="processing-spinner">
          <svg
            class="animate-spin h-16 w-16 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>

      <div class="state-content">
        <h2 class="state-title">{{ t("payment.processing.title") }}</h2>
        <p class="state-description">
          {{ t("payment.processing.description") }}
        </p>

        <div class="processing-steps">
          <div class="processing-step" :class="{ active: processingStep >= 1 }">
            <div class="step-dot"></div>
            <span>{{ t("payment.processing.stepVerify") }}</span>
          </div>
          <div class="processing-step" :class="{ active: processingStep >= 2 }">
            <div class="step-dot"></div>
            <span>{{ t("payment.processing.stepGateway") }}</span>
          </div>
          <div class="processing-step" :class="{ active: processingStep >= 3 }">
            <div class="step-dot"></div>
            <span>{{ t("payment.processing.stepConfirm") }}</span>
          </div>
        </div>

        <div v-if="transactionId" class="transaction-info">
          <p class="transaction-label">
            {{ t("payment.processing.transactionId") }}
          </p>
          <p class="transaction-id">{{ transactionId }}</p>
        </div>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="status === 'success'" class="state-container success-state">
      <div class="state-icon">
        <div class="success-checkmark">
          <svg
            class="h-16 w-16 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
          <div class="success-ring"></div>
        </div>
      </div>

      <div class="state-content">
        <h2 class="state-title text-green-700">
          {{ t("payment.processing.successTitle") }}
        </h2>
        <p class="state-description">
          {{ t("payment.processing.successDescription") }}
        </p>

        <div class="success-details">
          <div class="detail-row">
            <span class="detail-label">{{
              t("payment.processing.transactionId")
            }}</span>
            <span class="detail-value font-mono">{{ transactionId }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{
              t("payment.processing.paymentTime")
            }}</span>
            <span class="detail-value">{{ formatDateTime(new Date()) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{
              t("payment.processing.paymentStatus")
            }}</span>
            <span class="detail-value">
              <span class="status-badge success">{{
                t("payment.processing.completed")
              }}</span>
            </span>
          </div>
        </div>

        <div class="success-actions">
          <button class="btn btn-primary" @click="handleContinue">
            {{ t("payment.processing.continueShopping") }}
          </button>
          <button class="btn btn-secondary" @click="handleViewOrder">
            {{ t("payment.processing.viewOrder") }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="status === 'error'" class="state-container error-state">
      <div class="state-icon">
        <div class="error-icon">
          <svg
            class="h-16 w-16 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
        </div>
      </div>

      <div class="state-content">
        <h2 class="state-title text-red-700">
          {{ t("payment.processing.errorTitle") }}
        </h2>
        <p class="state-description">
          {{ errorMessage || t("payment.processing.errorDescription") }}
        </p>

        <div v-if="errorDetails" class="error-details">
          <details class="error-accordion">
            <summary class="error-summary">
              {{ t("payment.processing.viewErrorDetails") }}
            </summary>
            <div class="error-content">
              <p class="error-code">
                {{ t("payment.processing.errorCode") }}: {{ errorDetails.code }}
              </p>
              <p class="error-message">{{ errorDetails.message }}</p>
            </div>
          </details>
        </div>

        <div class="error-actions">
          <button
            class="btn btn-primary"
            :disabled="retryDisabled"
            @click="handleRetry"
          >
            <span v-if="retrying" class="btn-loading">
              <svg
                class="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ t("payment.processing.retrying") }}
            </span>
            <span v-else>{{ t("payment.processing.retryPayment") }}</span>
          </button>
          <button class="btn btn-secondary" @click="handleCancel">
            {{ t("payment.processing.cancelOrder") }}
          </button>
        </div>

        <div class="help-links">
          <p class="help-text">{{ t("payment.processing.needHelp") }}</p>
          <a href="#" class="help-link" @click="handleContactSupport">{{
            t("payment.processing.contactSupport")
          }}</a>
          <span class="help-divider">|</span>
          <a href="#" class="help-link" @click="handleViewFaq">{{
            t("payment.processing.faq")
          }}</a>
        </div>
      </div>
    </div>

    <!-- Cancelled State -->
    <div
      v-else-if="status === 'cancelled'"
      class="state-container cancelled-state"
    >
      <div class="state-icon">
        <div class="cancelled-icon">
          <svg
            class="h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </div>
      </div>

      <div class="state-content">
        <h2 class="state-title text-gray-700">
          {{ t("payment.processing.cancelledTitle") }}
        </h2>
        <p class="state-description">
          {{ t("payment.processing.cancelledDescription") }}
        </p>

        <div class="cancelled-actions">
          <button class="btn btn-primary" @click="handleReturnToShopping">
            {{ t("payment.processing.returnToShopping") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/i18n";

// Types
interface ErrorDetails {
  code: string;
  message: string;
}

// Props
interface Props {
  status: "processing" | "success" | "error" | "cancelled";
  transactionId?: string;
  errorMessage?: string;
  errorDetails?: ErrorDetails;
  retryDisabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  retryDisabled: false,
});

// Emits
interface Emits {
  (e: "retry"): void;
  (e: "close"): void;
  (e: "continue-shopping"): void;
  (e: "view-order"): void;
  (e: "contact-support"): void;
  (e: "cancel-order"): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();

// Reactive state
const processingStep = ref(1);
const retrying = ref(false);

// Processing step animation
let stepInterval: NodeJS.Timeout | null = null;

onMounted(() => {
  if (props.status === "processing") {
    startProcessingAnimation();
  }
});

onUnmounted(() => {
  if (stepInterval) {
    clearInterval(stepInterval);
  }
});

// Methods
const startProcessingAnimation = () => {
  processingStep.value = 1;

  stepInterval = setInterval(() => {
    processingStep.value =
      processingStep.value >= 3 ? 1 : processingStep.value + 1;
  }, 2000);
};

const handleRetry = async () => {
  retrying.value = true;

  try {
    emit("retry");
  } finally {
    // Reset retrying state after a short delay
    setTimeout(() => {
      retrying.value = false;
    }, 1000);
  }
};

const handleContinue = () => {
  emit("continue-shopping");
};

const handleViewOrder = () => {
  emit("view-order");
};

const handleCancel = () => {
  emit("cancel-order");
};

const handleContactSupport = () => {
  emit("contact-support");
};

const handleViewFaq = () => {
  // Open FAQ in new window
  window.open("/faq", "_blank");
};

const handleReturnToShopping = () => {
  emit("continue-shopping");
};

const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};
</script>

<style scoped>
/* Main container */
.payment-processing {
  @apply flex items-center justify-center min-h-[60vh] p-6;
}

.state-container {
  @apply max-w-lg w-full text-center space-y-8;
}

/* State icon */
.state-icon {
  @apply flex justify-center mb-6;
}

.processing-spinner {
  @apply relative;
}

.success-checkmark {
  @apply relative;
}

.success-ring {
  @apply absolute inset-0 rounded-full border-4 border-green-200
         animate-ping;
}

.error-icon,
.cancelled-icon {
  @apply p-4 rounded-full bg-red-50 border-2 border-red-100;
}

.cancelled-state .cancelled-icon {
  @apply bg-gray-50 border-gray-100;
}

/* State content */
.state-content {
  @apply space-y-6;
}

.state-title {
  @apply text-2xl font-semibold text-gray-900;
}

.state-description {
  @apply text-gray-600 text-lg leading-relaxed;
}

/* Processing steps */
.processing-steps {
  @apply space-y-4 text-left max-w-xs mx-auto;
}

.processing-step {
  @apply flex items-center space-x-3 text-sm text-gray-500
         transition-all duration-300;
}

.processing-step.active {
  @apply text-blue-600 font-medium;
}

.step-dot {
  @apply w-3 h-3 rounded-full border-2 border-gray-300
         transition-all duration-300;
}

.processing-step.active .step-dot {
  @apply border-blue-500 bg-blue-500;
}

/* Transaction info */
.transaction-info {
  @apply bg-gray-50 rounded-xl p-4 space-y-2;
}

.transaction-label {
  @apply text-sm text-gray-500 font-medium;
}

.transaction-id {
  @apply font-mono text-sm text-gray-900 break-all;
}

/* Success details */
.success-details {
  @apply bg-green-50 rounded-xl p-6 space-y-4 text-left;
}

.detail-row {
  @apply flex justify-between items-center;
}

.detail-label {
  @apply text-sm font-medium text-gray-600;
}

.detail-value {
  @apply text-sm text-gray-900;
}

.status-badge {
  @apply px-3 py-1 rounded-full text-xs font-medium;
}

.status-badge.success {
  @apply bg-green-100 text-green-800;
}

/* Actions */
.success-actions,
.error-actions,
.cancelled-actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center;
}

.btn {
  @apply px-6 py-3 rounded-xl font-medium transition-all duration-200
         focus:outline-none focus:ring-2 focus:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 
         focus:ring-blue-500 shadow-sm hover:shadow;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 
         focus:ring-gray-500;
}

.btn-loading {
  @apply flex items-center justify-center;
}

/* Error details */
.error-details {
  @apply mt-6;
}

.error-accordion {
  @apply text-left;
}

.error-summary {
  @apply text-sm text-blue-600 cursor-pointer hover:text-blue-700
         border border-blue-200 rounded-lg p-3 bg-blue-50
         transition-colors duration-200;
}

.error-content {
  @apply mt-3 p-4 bg-red-50 border border-red-200 rounded-lg space-y-2;
}

.error-code {
  @apply text-sm font-mono text-red-700;
}

.error-message {
  @apply text-sm text-red-600;
}

/* Help links */
.help-links {
  @apply pt-6 border-t border-gray-100 space-y-2;
}

.help-text {
  @apply text-sm text-gray-500;
}

.help-link {
  @apply text-sm text-blue-600 hover:text-blue-700 
         transition-colors duration-200;
}

.help-divider {
  @apply text-gray-300 mx-2;
}

/* Animations */
.success-checkmark svg {
  animation: checkmark-appear 0.6s ease-out;
}

@keyframes checkmark-appear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.error-icon,
.cancelled-icon {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .payment-processing {
    @apply p-4 min-h-[50vh];
  }

  .state-container {
    @apply space-y-6;
  }

  .state-title {
    @apply text-xl;
  }

  .state-description {
    @apply text-base;
  }

  .success-details,
  .error-content {
    @apply p-4;
  }

  .btn {
    @apply w-full;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .processing-spinner svg,
  .success-ring,
  .success-checkmark svg,
  .error-icon,
  .cancelled-icon {
    @apply animate-none;
  }

  .processing-step,
  .step-dot {
    @apply transition-none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .btn-primary {
    @apply bg-blue-800 border-2 border-blue-900;
  }

  .btn-secondary {
    @apply bg-gray-200 border-2 border-gray-400;
  }
}
</style>
