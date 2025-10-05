/**
 * Vue Composable for Error Tracking (PWA-Optimized)
 *
 * Includes offline queue support and network-aware error reporting
 */

import { ref, onMounted, onErrorCaptured, onBeforeUnmount } from "vue";
import { getErrorTracker, type TrackedError } from "@makanmakan/utils";

export function useErrorTracking() {
  const tracker = getErrorTracker({
    enabled: true,
    captureConsoleErrors: true,
    captureUnhandledRejections: true,
    debug: import.meta.env.DEV,
    onError: async (error) => {
      // PWA: Queue errors when offline
      if (!navigator.onLine) {
        await queueErrorForLater(error);
        return;
      }

      // Send to backend when online
      if (import.meta.env.PROD) {
        try {
          await fetch("/api/v1/system/errors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(error),
          });
        } catch (e) {
          console.error("[ErrorTracking] Failed to send error:", e);
          await queueErrorForLater(error);
        }
      }
    },
  });

  const errors = ref<TrackedError[]>([]);
  const stats = ref(tracker.getStats());
  const isOnline = ref(navigator.onLine);

  /**
   * Queue error for later transmission (offline support)
   */
  async function queueErrorForLater(error: TrackedError): Promise<void> {
    try {
      if ("indexedDB" in window) {
        const db = await openErrorDB();
        const tx = db.transaction("errors", "readwrite");
        const store = tx.objectStore("errors");
        await store.add({
          ...error,
          queuedAt: Date.now(),
        });
      }
    } catch (e) {
      console.error("[ErrorTracking] Failed to queue error:", e);
    }
  }

  /**
   * Helper to promisify IDB requests
   */
  function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Process queued errors when back online
   */
  async function processQueuedErrors(): Promise<void> {
    if (!navigator.onLine) return;

    try {
      if ("indexedDB" in window) {
        const db = await openErrorDB();
        const tx = db.transaction("errors", "readonly");
        const store = tx.objectStore("errors");
        const allErrors = await idbRequest(store.getAll());

        if (allErrors.length === 0) return;

        // Send all queued errors
        for (const error of allErrors) {
          try {
            await fetch("/api/v1/system/errors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(error),
            });

            // Remove from queue after successful send
            const deleteTx = db.transaction("errors", "readwrite");
            const deleteStore = deleteTx.objectStore("errors");
            await idbRequest(deleteStore.delete(error.id));
          } catch (e) {
            console.error("[ErrorTracking] Failed to send queued error:", e);
            break; // Stop processing if network fails
          }
        }
      }
    } catch (e) {
      console.error("[ErrorTracking] Failed to process queued errors:", e);
    }
  }

  /**
   * Open IndexedDB for error queue
   */
  function openErrorDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ErrorTrackingDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("errors")) {
          db.createObjectStore("errors", { keyPath: "id" });
        }
      };
    });
  }

  /**
   * Handle online/offline events
   */
  function handleOnline(): void {
    isOnline.value = true;
    processQueuedErrors();
  }

  function handleOffline(): void {
    isOnline.value = false;
  }

  // Update errors and stats periodically
  const updateInterval = window.setInterval(() => {
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

    // Listen for online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Process any queued errors on mount
    if (navigator.onLine) {
      processQueuedErrors();
    }
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

  onBeforeUnmount(() => {
    clearInterval(updateInterval);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  });

  return {
    tracker,
    errors,
    stats,
    isOnline,
    captureError: tracker.captureError.bind(tracker),
    captureException: tracker.captureException.bind(tracker),
    captureMessage: tracker.captureMessage.bind(tracker),
    addBreadcrumb: tracker.addBreadcrumb.bind(tracker),
    setUser: tracker.setUser.bind(tracker),
  };
}
