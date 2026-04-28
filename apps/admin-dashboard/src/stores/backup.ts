/**
 * Backup Store - Pinia store for backup management
 * Handles all backup-related API interactions and state management
 */

import { defineStore } from "pinia";
import { ref } from "vue";
// Import from @makanmakan/shared-types
import type {
  BackupConfiguration,
  BackupRecord,
  BackupSystemHealth,
  BackupAlert,
  CreateBackupRequest,
  CreateBackupResponse,
  ListBackupsQuery,
  RestoreBackupRequest,
} from "@makanmakan/shared-types";

// Re-export types from shared-types for convenience
export type {
  BackupStatus,
  BackupType,
  StorageProvider,
} from "@makanmakan/shared-types";
// Import the actual API client
import { apiClient } from "@/services/api";

export const useBackupStore = defineStore("backup", () => {
  // State
  const isLoading = ref(false);
  const backups = ref<BackupRecord[]>([]);
  const configurations = ref<BackupConfiguration[]>([]);
  const systemHealth = ref<BackupSystemHealth | null>(null);
  const alerts = ref<BackupAlert[]>([]);

  // Actions
  const createBackup = async (
    request: CreateBackupRequest,
  ): Promise<CreateBackupResponse> => {
    try {
      const response = await apiClient.post("/backup/create", request);
      return (response.data as any).data as CreateBackupResponse;
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  };

  const listBackups = async (query: ListBackupsQuery) => {
    try {
      const response = await apiClient.get("/backup/list", {
        params: query,
      });
      return (response.data as any).data || [];
    } catch (error) {
      console.error("Error listing backups:", error);
      throw error;
    }
  };

  const getBackup = async (backupId: string): Promise<BackupRecord> => {
    try {
      const response = await apiClient.get(`/backup/${backupId}`);
      return (response.data as any).data as BackupRecord;
    } catch (error) {
      console.error("Error getting backup:", error);
      throw error;
    }
  };

  const downloadBackup = async (backupId: string): Promise<void> => {
    try {
      const response = await apiClient.get(`/backup/${backupId}/download`, {
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data as any]));
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from response headers or generate one
      const contentDisposition = response.headers?.["content-disposition"];
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `backup_${backupId}.json`;

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading backup:", error);
      throw error;
    }
  };

  const restoreBackup = async (
    request: RestoreBackupRequest,
  ): Promise<string> => {
    try {
      const response = await apiClient.post(
        `/backup/${request.backup_id}/restore`,
        request,
      );
      return (response.data as any).data?.restore_id;
    } catch (error) {
      console.error("Error restoring backup:", error);
      throw error;
    }
  };

  const deleteBackup = async (backupId: string): Promise<void> => {
    try {
      await apiClient.delete(`/backup/${backupId}`);
    } catch (error) {
      console.error("Error deleting backup:", error);
      throw error;
    }
  };

  // Backup Configurations
  const getBackupConfigurations = async (
    restaurantId: string,
  ): Promise<BackupConfiguration[]> => {
    try {
      const response = await apiClient.get(
        `/backup/configurations/${restaurantId}`,
      );
      configurations.value = (response.data as any).data;
      return (response.data as any).data;
    } catch (error) {
      console.error("Error getting backup configurations:", error);
      throw error;
    }
  };

  const createOrUpdateConfiguration = async (
    config: Partial<BackupConfiguration>,
  ): Promise<BackupConfiguration> => {
    try {
      const response = await apiClient.post("/backup/configurations", config);

      // Update local configurations array
      const index = configurations.value.findIndex(
        (c: BackupConfiguration) => c.id === config.id,
      );
      const configData = (response.data as any).data;
      if (index >= 0) {
        configurations.value[index] = configData;
      } else {
        configurations.value.push(configData);
      }

      return configData;
    } catch (error) {
      console.error("Error saving backup configuration:", error);
      throw error;
    }
  };

  // System Monitoring
  const getSystemHealth = async (): Promise<BackupSystemHealth> => {
    try {
      const response = await apiClient.get("/backup/system/health");
      systemHealth.value = (response.data as any).data;
      return (response.data as any).data;
    } catch (error) {
      console.error("Error getting system health:", error);
      throw error;
    }
  };

  const getRestaurantMetrics = async (
    restaurantId: string,
    period: "hour" | "day" | "week" | "month" = "week",
  ) => {
    try {
      const response = await apiClient.get(
        `/backup/restaurants/${restaurantId}/metrics`,
        {
          params: { period },
        },
      );
      return (response.data as any).data;
    } catch (error) {
      console.error("Error getting restaurant metrics:", error);
      throw error;
    }
  };

  const getRestaurantAlerts = async (
    restaurantId: string,
    unresolved_only: boolean = false,
  ): Promise<BackupAlert[]> => {
    try {
      const response = await apiClient.get(`/backup/alerts/${restaurantId}`, {
        params: { unresolved_only },
      });
      alerts.value = (response.data as any).data;
      return (response.data as any).data;
    } catch (error) {
      console.error("Error getting restaurant alerts:", error);
      throw error;
    }
  };

  // Alert Management
  const acknowledgeAlert = async (alertId: string): Promise<void> => {
    try {
      await apiClient.patch(`/backup/alerts/${alertId}/acknowledge`);

      // Update local alerts array
      const alert = alerts.value.find((a: BackupAlert) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledged_at = new Date().toISOString();
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      throw error;
    }
  };

  const resolveAlert = async (alertId: string): Promise<void> => {
    try {
      await apiClient.patch(`/backup/alerts/${alertId}/resolve`);

      // Update local alerts array
      const alert = alerts.value.find((a: BackupAlert) => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolved_at = new Date().toISOString();
      }
    } catch (error) {
      console.error("Error resolving alert:", error);
      throw error;
    }
  };

  // Utility Actions
  const refreshBackups = async (restaurantId: string) => {
    isLoading.value = true;
    try {
      const response = await listBackups({
        restaurant_id: restaurantId,
        limit: 50,
        sort_by: "created_at",
        sort_order: "desc",
      });
      backups.value = response;
    } catch (error) {
      console.error("Error refreshing backups:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const clearCache = () => {
    backups.value = [];
    configurations.value = [];
    systemHealth.value = null;
    alerts.value = [];
  };

  // Real-time Updates (placeholder for future WebSocket integration)
  const subscribeToUpdates = (restaurantId: string) => {
    // TODO: Implement WebSocket connection for real-time backup status updates
    console.log("Subscribing to backup updates for restaurant:", restaurantId);
  };

  const unsubscribeFromUpdates = () => {
    // TODO: Cleanup WebSocket connection
    console.log("Unsubscribing from backup updates");
  };

  // Backup Status Polling (for active backups)
  const pollBackupStatus = async (backupId: string): Promise<BackupRecord> => {
    try {
      const backup = await getBackup(backupId);

      // Update local backup if it exists in the array
      const index = backups.value.findIndex(
        (b: BackupRecord) => b.id === backupId,
      );
      if (index >= 0) {
        backups.value[index] = backup;
      }

      return backup;
    } catch (error) {
      console.error("Error polling backup status:", error);
      throw error;
    }
  };

  // Auto-refresh for active backups
  const startAutoRefresh = (_restaurantId?: string) => {
    const interval = setInterval(async () => {
      try {
        // Check if there are any active backups
        const activeBackups = backups.value.filter(
          (b: BackupRecord) =>
            b.status === "in_progress" || b.status === "pending",
        );

        if (activeBackups.length === 0) {
          clearInterval(interval);
          return;
        }

        // Poll status for each active backup
        await Promise.all(
          activeBackups.map((backup: BackupRecord) =>
            pollBackupStatus(backup.id),
          ),
        );
      } catch (error) {
        console.error("Error in auto-refresh:", error);
      }
    }, 5000); // Poll every 5 seconds

    return interval;
  };

  return {
    // State
    isLoading,
    backups,
    configurations,
    systemHealth,
    alerts,

    // Actions
    createBackup,
    listBackups,
    getBackup,
    downloadBackup,
    restoreBackup,
    deleteBackup,

    // Configuration management
    getBackupConfigurations,
    createOrUpdateConfiguration,

    // System monitoring
    getSystemHealth,
    getRestaurantMetrics,
    getRestaurantAlerts,

    // Alert management
    acknowledgeAlert,
    resolveAlert,

    // Utilities
    refreshBackups,
    clearCache,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    pollBackupStatus,
    startAutoRefresh,
  };
});
