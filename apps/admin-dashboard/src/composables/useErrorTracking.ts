/**
 * Vue Composable for Error Tracking
 */

import { ref, onMounted, onErrorCaptured } from "vue";
import { getErrorTracker, type TrackedError } from "@makanmakan/utils";

export function useErrorTracking() {
  const tracker = getErrorTracker({
    enabled: true,
    captureConsoleErrors: true,
    captureUnhandledRejections: true,
    debug: import.meta.env.DEV,
    onError: async (error: TrackedError) => {
      // Send to backend
      if (import.meta.env.PROD) {
        try {
          await fetch("/api/v1/system/errors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(error),
          });
        } catch (e) {
          console.error("[ErrorTracking] Failed to send error:", e);
        }
      }
    },
  });

  const errors = ref<TrackedError[]>([]);
  const stats = ref(tracker.getStats());

  // Update errors and stats periodically
  const updateInterval = setInterval(() => {
    errors.value = tracker.getErrors();
    stats.value = tracker.getStats();
  }, 5000);

  onMounted(() => {
    // Set app context
    tracker.setContext({
      app: {
        version: import.meta.env.VITE_APP_VERSION || "1.0.0",
        environment: import.meta.env.MODE,
        userAgent: navigator.userAgent,
      },
    });
  });

  // Capture component errors
  onErrorCaptured((error, instance, info) => {
    tracker.captureError(error, {
      severity: "high",
      category: "system",
      context: {
        extra: {
          componentName: instance?.$options.name,
          errorInfo: info,
        },
      },
    });
    return false; // Prevent propagation
  });

  return {
    tracker,
    errors,
    stats,
    captureError: tracker.captureError.bind(tracker),
    captureException: tracker.captureException.bind(tracker),
    captureMessage: tracker.captureMessage.bind(tracker),
    addBreadcrumb: tracker.addBreadcrumb.bind(tracker),
    setUser: tracker.setUser.bind(tracker),
    cleanup: () => clearInterval(updateInterval),
  };
}
