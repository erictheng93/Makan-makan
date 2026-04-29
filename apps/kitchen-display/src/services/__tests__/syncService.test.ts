/**
 * OfflineService - Synchronization Logic Tests
 * Tests action queuing, online/offline sync triggering, periodic sync,
 * max retry handling, conflict resolution, and canSync logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock("@/services/authApi", () => ({
  apiClient: {
    post: mockApiPost,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────
// We must reset the singleton module between tests so each suite
// gets a clean OfflineService instance with fresh reactive state.

let offlineService: (typeof import("@/services/offlineService"))["offlineService"];

// Store captured event listeners so we can simulate online/offline/visibility
const windowListeners: Record<string, EventListener[]> = {};
const documentListeners: Record<string, EventListener[]> = {};

function captureWindowListener(event: string, fn: EventListener) {
  if (!windowListeners[event]) windowListeners[event] = [];
  windowListeners[event].push(fn);
}

function captureDocumentListener(event: string, fn: EventListener) {
  if (!documentListeners[event]) documentListeners[event] = [];
  documentListeners[event].push(fn);
}

function fireWindowEvent(event: string) {
  (windowListeners[event] || []).forEach((fn) => fn(new Event(event)));
}

function fireDocumentEvent(event: string) {
  (documentListeners[event] || []).forEach((fn) => fn(new Event(event)));
}

describe("OfflineService - Sync Logic", () => {
  beforeEach(async () => {
    vi.useFakeTimers();

    // Reset captured listeners
    Object.keys(windowListeners).forEach((k) => delete windowListeners[k]);
    Object.keys(documentListeners).forEach((k) => delete documentListeners[k]);

    // Spy on addEventListener to capture handlers registered by the service
    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: any) => {
        captureWindowListener(event, handler);
      },
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
    vi.spyOn(document, "addEventListener").mockImplementation(
      (event: string, handler: any) => {
        captureDocumentListener(event, handler);
      },
    );
    vi.spyOn(document, "removeEventListener").mockImplementation(() => {});

    // navigator.onLine defaults to true
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    // document.hidden defaults to false
    Object.defineProperty(document, "hidden", { value: false, writable: true });

    // Clean localStorage mock data
    localStorage.clear();
    vi.mocked(localStorage.getItem).mockClear();
    vi.mocked(localStorage.setItem).mockClear();
    vi.mocked(localStorage.removeItem).mockClear();

    mockApiPost.mockReset();
    mockApiPost.mockResolvedValue({ data: { success: true } });

    // Re-import module to get a fresh singleton each time
    vi.resetModules();
    const mod = await import("@/services/offlineService");
    offlineService = mod.offlineService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Action Queuing
  // ────────────────────────────────────────────────────────────────
  describe("queueAction", () => {
    it("should create an OfflineAction and add it to pendingActions", () => {
      const actionId = offlineService.queueAction(
        "start_cooking",
        101,
        { status: "preparing" },
        42,
      );

      expect(actionId).toMatch(/^action_/);
      expect(offlineService.pendingActions.value).toHaveLength(1);

      const action = offlineService.pendingActions.value[0];
      expect(action.type).toBe("start_cooking");
      expect(action.orderId).toBe(101);
      expect(action.itemId).toBe(42);
      expect(action.payload).toEqual({ status: "preparing" });
      expect(action.synced).toBe(false);
      expect(action.retryCount).toBe(0);
    });

    it("should return a unique id for each queued action", () => {
      const id1 = offlineService.queueAction("start_cooking", 1, {});
      vi.advanceTimersByTime(1); // ensure different Date.now()
      const id2 = offlineService.queueAction("mark_ready", 2, {});

      expect(id1).not.toBe(id2);
    });

    it("should save data to localStorage after queuing", () => {
      offlineService.queueAction("update_status", 10, { status: "ready" });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-offline-data",
        expect.any(String),
      );
    });

    it("should trigger syncPendingActions when online", async () => {
      offlineService.isOnline.value = true;
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      offlineService.queueAction("mark_ready", 5, {}, 10);

      expect(syncSpy).toHaveBeenCalled();
    });

    it("should NOT trigger sync when offline", () => {
      offlineService.isOnline.value = false;
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      offlineService.queueAction("priority_change", 3, { priority: "high" });

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it("should support queuing without itemId", () => {
      offlineService.queueAction("update_status", 7, { status: "preparing" });

      const action = offlineService.pendingActions.value[0];
      expect(action.itemId).toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. syncPendingActions
  // ────────────────────────────────────────────────────────────────
  describe("syncPendingActions", () => {
    it("should do nothing when pendingActions is empty", async () => {
      await offlineService.syncPendingActions();
      expect(offlineService.syncInProgress.value).toBe(false);
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it("should do nothing when offline (canSync = false)", async () => {
      offlineService.isOnline.value = false;
      // Queue directly to avoid triggering sync in queueAction
      offlineService.pendingActions.value.push({
        id: "action_1",
        type: "start_cooking",
        orderId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      // Should not have started sync
      expect(offlineService.pendingActions.value).toHaveLength(1);
    });

    it("should do nothing when syncInProgress is already true", async () => {
      offlineService.syncInProgress.value = true;
      offlineService.pendingActions.value.push({
        id: "action_1",
        type: "start_cooking",
        orderId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      // Actions remain because canSync was false
      expect(offlineService.pendingActions.value).toHaveLength(1);
    });

    it("should set syncInProgress=true during sync and false after", async () => {
      offlineService.isOnline.value = true;
      offlineService.syncInProgress.value = false;

      let capturedSyncInProgress: boolean | undefined;
      mockApiPost.mockImplementation(async () => {
        capturedSyncInProgress = offlineService.syncInProgress.value;
        return { data: { success: true } };
      });

      offlineService.pendingActions.value.push({
        id: "action_sync_progress",
        type: "update_status",
        orderId: 5,
        payload: { status: "preparing" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      expect(capturedSyncInProgress).toBe(true);
      expect(offlineService.syncInProgress.value).toBe(false);
    });

    it("should remove synced actions after successful sync", async () => {
      offlineService.isOnline.value = true;
      mockApiPost.mockResolvedValue({ data: { success: true } });

      offlineService.pendingActions.value.push(
        {
          id: "action_a",
          type: "start_cooking",
          orderId: 1,
          itemId: 10,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0,
        },
        {
          id: "action_b",
          type: "mark_ready",
          orderId: 2,
          itemId: 20,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0,
        },
      );

      await offlineService.syncPendingActions();

      expect(offlineService.pendingActions.value).toHaveLength(0);
    });

    it("should update lastSyncTime after successful sync", async () => {
      offlineService.isOnline.value = true;
      mockApiPost.mockResolvedValue({ data: { success: true } });

      const before = Date.now();
      offlineService.pendingActions.value.push({
        id: "action_time",
        type: "update_status",
        orderId: 3,
        payload: { status: "ready" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      expect(offlineService.lastSyncTime.value).toBeGreaterThanOrEqual(before);
    });

    it("should only sync unsynced actions", async () => {
      offlineService.isOnline.value = true;

      offlineService.pendingActions.value.push(
        {
          id: "already_synced",
          type: "start_cooking",
          orderId: 1,
          payload: {},
          timestamp: Date.now(),
          synced: true,
          retryCount: 0,
        },
        {
          id: "needs_sync",
          type: "mark_ready",
          orderId: 2,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0,
        },
      );

      mockApiPost.mockResolvedValue({ data: { success: true } });

      await offlineService.syncPendingActions();

      // API client called once for the unsynced action only
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. syncSingleAction - retry & error handling
  // ────────────────────────────────────────────────────────────────
  // NOTE: sendActionToServer has a catch block that returns { success: true }
  // when the API client throws (simulation fallback). To test actual
  // failure/retry behavior, we must have the API client resolve with data where
  // success=false and no conflict, which causes syncSingleAction to throw.
  describe("syncSingleAction (via syncPendingActions)", () => {
    it("should increment retryCount on server-side failure", async () => {
      offlineService.isOnline.value = true;

      // Return a resolved response whose data indicates failure
      mockApiPost.mockResolvedValue({
        data: {
          success: false,
          error: "Server error",
        },
      });

      const action = {
        id: "action_fail",
        type: "update_status" as const,
        orderId: 10,
        payload: { status: "preparing" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      };
      offlineService.pendingActions.value.push(action);

      vi.spyOn(console, "error").mockImplementation(() => {});
      await offlineService.syncPendingActions();

      expect(action.retryCount).toBe(1);
      expect((action as any).error).toBe("Server error");
    });

    it("should keep failed actions in pendingActions for retry", async () => {
      offlineService.isOnline.value = true;

      mockApiPost.mockResolvedValue({
        data: {
          success: false,
          error: "Temporary failure",
        },
      });

      const action = {
        id: "action_retry",
        type: "start_cooking" as const,
        orderId: 5,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      };
      offlineService.pendingActions.value.push(action);

      vi.spyOn(console, "error").mockImplementation(() => {});
      await offlineService.syncPendingActions();

      // Action should still be present (not removed) because it was not synced
      expect(offlineService.pendingActions.value).toHaveLength(1);
      expect(offlineService.pendingActions.value[0].synced).toBe(false);
    });

    it("should stop retrying after MAX_RETRY_ATTEMPTS (5)", async () => {
      offlineService.isOnline.value = true;

      mockApiPost.mockResolvedValue({
        data: {
          success: false,
          error: "Persistent failure",
        },
      });

      const action = {
        id: "action_max_retry",
        type: "mark_ready" as const,
        orderId: 99,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 4, // already at 4
      };
      offlineService.pendingActions.value.push(action);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await offlineService.syncPendingActions();

      // retryCount should now be 5 (at max)
      expect(action.retryCount).toBe(5);
      // Console error logged for max retries
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("action_max_retry"),
        expect.any(Error),
      );
    });

    it("should treat API client rejection as success due to sendActionToServer fallback", async () => {
      // When the API client throws, sendActionToServer catches it and returns
      // { success: true }. This is the current simulation behavior.
      offlineService.isOnline.value = true;

      mockApiPost.mockRejectedValue(new Error("Network error"));

      offlineService.pendingActions.value.push({
        id: "action_transport_fail",
        type: "update_status",
        orderId: 10,
        payload: { status: "preparing" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      // The action should be marked as synced because sendActionToServer
      // caught the transport error and returned { success: true }
      expect(offlineService.pendingActions.value).toHaveLength(0);
    });

    it("should handle conflict response from server", async () => {
      offlineService.isOnline.value = true;

      mockApiPost.mockResolvedValue({
        data: {
          success: false,
          conflict: {
            type: "status_conflict",
            serverData: { status: "ready" },
          },
        },
      });

      offlineService.pendingActions.value.push({
        id: "action_conflict",
        type: "update_status",
        orderId: 42,
        payload: { status: "preparing" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      // A conflict should have been registered
      expect(offlineService.syncConflicts.value).toHaveLength(1);
      expect(offlineService.syncConflicts.value[0].type).toBe(
        "status_conflict",
      );
      expect(offlineService.syncConflicts.value[0].id).toBe(
        "conflict_action_conflict",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. Online/Offline Event Handling
  // ────────────────────────────────────────────────────────────────
  describe("online/offline event handling", () => {
    it("should register window online/offline listeners in constructor", () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        "online",
        expect.any(Function),
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        "offline",
        expect.any(Function),
      );
    });

    it("should register document visibilitychange listener", () => {
      expect(document.addEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
    });

    it("should set isOnline=true and trigger sync on online event", () => {
      offlineService.isOnline.value = false;
      offlineService.isOfflineMode.value = true;
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      fireWindowEvent("online");

      expect(offlineService.isOnline.value).toBe(true);
      expect(offlineService.isOfflineMode.value).toBe(false);
      expect(syncSpy).toHaveBeenCalled();
    });

    it("should set isOnline=false and isOfflineMode=true on offline event", () => {
      offlineService.isOnline.value = true;
      offlineService.isOfflineMode.value = false;

      fireWindowEvent("offline");

      expect(offlineService.isOnline.value).toBe(false);
      expect(offlineService.isOfflineMode.value).toBe(true);
    });

    it("should sync when page becomes visible and online", () => {
      offlineService.isOnline.value = true;
      Object.defineProperty(document, "hidden", {
        value: false,
        writable: true,
      });
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      fireDocumentEvent("visibilitychange");

      expect(syncSpy).toHaveBeenCalled();
    });

    it("should NOT sync when page becomes visible but offline", () => {
      offlineService.isOnline.value = false;
      Object.defineProperty(document, "hidden", {
        value: false,
        writable: true,
      });
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      fireDocumentEvent("visibilitychange");

      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. Periodic Sync
  // ────────────────────────────────────────────────────────────────
  describe("periodic sync (startPeriodicSync)", () => {
    it("should call syncPendingActions every 30 seconds when online with pending actions", () => {
      offlineService.isOnline.value = true;
      offlineService.pendingActions.value.push({
        id: "periodic_test",
        type: "start_cooking",
        orderId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      expect(syncSpy).toHaveBeenCalled();
    });

    it("should NOT call sync during periodic interval when there are no pending actions", () => {
      offlineService.isOnline.value = true;
      // pendingActions is empty
      const syncSpy = vi.spyOn(offlineService, "syncPendingActions");

      vi.advanceTimersByTime(30000);

      // The interval fires but the condition check prevents syncPendingActions call
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. Conflict Resolution
  // ────────────────────────────────────────────────────────────────
  describe("resolveConflict", () => {
    it("should resolve conflict with 'local' resolution and remove from syncConflicts", () => {
      offlineService.syncConflicts.value.push({
        id: "conflict_1",
        type: "order_updated",
        localData: { status: "preparing" },
        serverData: { status: "ready" },
      });

      offlineService.resolveConflict("conflict_1", "local");

      expect(offlineService.syncConflicts.value).toHaveLength(0);
    });

    it("should resolve conflict with 'server' resolution", () => {
      offlineService.syncConflicts.value.push({
        id: "conflict_2",
        type: "status_conflict",
        localData: { status: "confirmed" },
        serverData: { status: "delivered" },
      });

      offlineService.resolveConflict("conflict_2", "server");

      expect(offlineService.syncConflicts.value).toHaveLength(0);
    });

    it("should resolve conflict with 'merge' resolution", () => {
      offlineService.syncConflicts.value.push({
        id: "conflict_3",
        type: "order_deleted",
        localData: { name: "local" },
        serverData: { name: "server" },
      });

      offlineService.resolveConflict("conflict_3", "merge");

      expect(offlineService.syncConflicts.value).toHaveLength(0);
    });

    it("should do nothing when conflictId is not found", () => {
      offlineService.syncConflicts.value.push({
        id: "conflict_existing",
        type: "order_updated",
        localData: {},
        serverData: {},
      });

      offlineService.resolveConflict("non_existent", "local");

      // The existing conflict should still be there
      expect(offlineService.syncConflicts.value).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. forcSync and cancelSync
  // ────────────────────────────────────────────────────────────────
  describe("forcSync and cancelSync", () => {
    it("forcSync should delegate to syncPendingActions", async () => {
      const syncSpy = vi
        .spyOn(offlineService, "syncPendingActions")
        .mockResolvedValue();

      await offlineService.forcSync();

      expect(syncSpy).toHaveBeenCalled();
    });

    it("cancelSync should set syncInProgress to false", () => {
      offlineService.syncInProgress.value = true;

      offlineService.cancelSync();

      expect(offlineService.syncInProgress.value).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. Computed getters
  // ────────────────────────────────────────────────────────────────
  describe("computed properties", () => {
    it("hasPendingActions should be true when actions exist", () => {
      offlineService.pendingActions.value.push({
        id: "test",
        type: "start_cooking",
        orderId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      expect(offlineService.hasPendingActions.value).toBe(true);
    });

    it("hasPendingActions should be false when no actions", () => {
      offlineService.pendingActions.value = [];
      expect(offlineService.hasPendingActions.value).toBe(false);
    });

    it("hasConflicts should reflect syncConflicts length", () => {
      expect(offlineService.hasConflicts.value).toBe(false);

      offlineService.syncConflicts.value.push({
        id: "c1",
        type: "order_updated",
        localData: {},
        serverData: {},
      });

      expect(offlineService.hasConflicts.value).toBe(true);
    });

    it("canSync should be true when online and not syncing", () => {
      offlineService.isOnline.value = true;
      offlineService.syncInProgress.value = false;

      expect(offlineService.canSync.value).toBe(true);
    });

    it("canSync should be false when offline", () => {
      offlineService.isOnline.value = false;
      offlineService.syncInProgress.value = false;

      expect(offlineService.canSync.value).toBe(false);
    });

    it("canSync should be false when sync is in progress", () => {
      offlineService.isOnline.value = true;
      offlineService.syncInProgress.value = true;

      expect(offlineService.canSync.value).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. API endpoint construction
  // ────────────────────────────────────────────────────────────────
  describe("API endpoint construction (sendActionToServer)", () => {
    it("should call the correct endpoint for start_cooking actions", async () => {
      offlineService.isOnline.value = true;

      offlineService.pendingActions.value.push({
        id: "ep_test",
        type: "start_cooking",
        orderId: 55,
        itemId: 12,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/55/items/12/start"),
        expect.any(Object),
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
    });

    it("should call the correct endpoint for batch_operation actions", async () => {
      offlineService.isOnline.value = true;

      offlineService.pendingActions.value.push({
        id: "ep_batch",
        type: "batch_operation",
        orderId: 88,
        payload: { operation: "start_all" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      await offlineService.syncPendingActions();

      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/kitchen/88/batch"),
        expect.any(Object),
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
    });
  });
});
