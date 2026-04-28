/**
 * Backup Store Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useBackupStore } from "../backup";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";

describe("Backup Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have empty initial state", () => {
      const store = useBackupStore();
      expect(store.isLoading).toBe(false);
      expect(store.backups).toEqual([]);
      expect(store.configurations).toEqual([]);
      expect(store.systemHealth).toBeNull();
      expect(store.alerts).toEqual([]);
    });
  });

  describe("createBackup", () => {
    it("should call POST /backup/create and return data", async () => {
      const mockResponse = {
        data: { data: { id: "backup-1", status: "pending" } },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const store = useBackupStore();
      const request = {
        restaurant_id: "r1",
        type: "full" as const,
        description: "Test backup",
      };

      const result = await store.createBackup(request);

      expect(apiClient.post).toHaveBeenCalledOnce();
      expect(apiClient.post).toHaveBeenCalledWith("/backup/create", request);
      expect(result).toEqual({ id: "backup-1", status: "pending" });
    });

    it("should throw on API error", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Network error"));

      const store = useBackupStore();
      await expect(
        store.createBackup({ restaurant_id: "r1", type: "full" as const }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("listBackups", () => {
    it("should call GET with query params", async () => {
      const backups = [{ id: "b1" }, { id: "b2" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: backups },
      });

      const store = useBackupStore();
      const query = { restaurant_id: "r1", limit: 10 };
      const result = await store.listBackups(query);

      expect(apiClient.get).toHaveBeenCalledWith("/backup/list", {
        params: query,
      });
      expect(result).toEqual(backups);
    });
  });

  describe("getBackup", () => {
    it("should fetch a single backup by id", async () => {
      const backup = { id: "b1", status: "completed" };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: backup },
      });

      const store = useBackupStore();
      const result = await store.getBackup("b1");

      expect(apiClient.get).toHaveBeenCalledWith("/backup/b1");
      expect(result).toEqual(backup);
    });
  });

  describe("deleteBackup", () => {
    it("should call DELETE endpoint", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      const store = useBackupStore();
      await store.deleteBackup("b1");

      expect(apiClient.delete).toHaveBeenCalledWith("/backup/b1");
    });
  });

  describe("restoreBackup", () => {
    it("should POST restore request and return operation_id", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: { restore_id: "op-123" } },
      });

      const store = useBackupStore();
      const result = await store.restoreBackup({
        backup_id: "b1",
        target_environment: "staging",
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/backup/b1/restore",
        expect.objectContaining({ backup_id: "b1" }),
      );
      expect(result).toBe("op-123");
    });
  });

  describe("getBackupConfigurations", () => {
    it("should fetch configs and update local state", async () => {
      const configs = [{ id: "c1", enabled: true }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: configs },
      });

      const store = useBackupStore();
      const result = await store.getBackupConfigurations("r1");

      expect(apiClient.get).toHaveBeenCalledWith("/backup/configurations/r1");
      expect(result).toEqual(configs);
      expect(store.configurations).toEqual(configs);
    });
  });

  describe("getSystemHealth", () => {
    it("should fetch health and update local state", async () => {
      const health = { status: "healthy", uptime: 99.9 };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: health },
      });

      const store = useBackupStore();
      const result = await store.getSystemHealth();

      expect(apiClient.get).toHaveBeenCalledWith("/backup/system/health");
      expect(result).toEqual(health);
      expect(store.systemHealth).toEqual(health);
    });
  });

  describe("acknowledgeAlert", () => {
    it("should PATCH acknowledge and update local alert", async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });

      const store = useBackupStore();
      // Seed local alerts
      store.alerts.push({
        id: "a1",
        acknowledged: false,
        acknowledged_at: null,
      } as any);

      await store.acknowledgeAlert("a1");

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/backup/alerts/a1/acknowledge",
      );
      expect(store.alerts[0].acknowledged).toBe(true);
      expect(store.alerts[0].acknowledged_at).toEqual(expect.any(String));
    });
  });

  describe("resolveAlert", () => {
    it("should PATCH resolve and update local alert", async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });

      const store = useBackupStore();
      store.alerts.push({
        id: "a2",
        resolved: false,
        resolved_at: null,
      } as any);

      await store.resolveAlert("a2");

      expect(apiClient.patch).toHaveBeenCalledWith("/backup/alerts/a2/resolve");
      expect(store.alerts[0].resolved).toBe(true);
    });
  });

  describe("refreshBackups", () => {
    it("should set isLoading and populate backups", async () => {
      const backups = [{ id: "b1" }];
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: backups },
      });

      const store = useBackupStore();
      await store.refreshBackups("r1");

      expect(store.isLoading).toBe(false);
      expect(store.backups).toEqual(backups);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/backup/list",
        expect.objectContaining({
          params: expect.objectContaining({
            restaurant_id: "r1",
            limit: 50,
          }),
        }),
      );
    });

    it("should reset isLoading on error", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("fail"));

      const store = useBackupStore();
      await expect(store.refreshBackups("r1")).rejects.toThrow("fail");
      expect(store.isLoading).toBe(false);
    });
  });

  describe("clearCache", () => {
    it("should reset all state", () => {
      const store = useBackupStore();
      store.backups.push({ id: "b1" } as any);
      store.configurations.push({ id: "c1" } as any);
      store.systemHealth = { status: "healthy" } as any;
      store.alerts.push({ id: "a1" } as any);

      store.clearCache();

      expect(store.backups).toEqual([]);
      expect(store.configurations).toEqual([]);
      expect(store.systemHealth).toBeNull();
      expect(store.alerts).toEqual([]);
    });
  });

  describe("pollBackupStatus", () => {
    it("should fetch backup and update in local array", async () => {
      const updatedBackup = { id: "b1", status: "completed" };
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: updatedBackup },
      });

      const store = useBackupStore();
      store.backups.push({ id: "b1", status: "in_progress" } as any);

      const result = await store.pollBackupStatus("b1");

      expect(result).toEqual(updatedBackup);
      expect(store.backups[0].status).toBe("completed");
    });
  });
});
