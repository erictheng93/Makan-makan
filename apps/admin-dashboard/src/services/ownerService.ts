import { api } from "./api";

class OwnerService {
  getQuickActionRoute(action: string): string | null {
    const routes: Record<string, string> = {
      "add-staff": "/dashboard/employees",
      "update-menu": "/dashboard/menu",
      "view-reports": "/dashboard/analytics",
      "system-settings": "/dashboard/settings",
    };
    return routes[action] ?? null;
  }

  // These two have live call sites (OwnerView handleAlertAction) but no
  // endpoint: the API mounts no top-level /alerts, and the /backup/alerts and
  // /monitoring/alerts routes are a different concern with different methods.
  // They are unreachable today only because OwnerView's alert list is a
  // hardcoded empty ref, so they are kept rather than deleted until #285
  // decides whether the emergency-alert panel is built or removed.
  async resolveEmergencyAlert(alertId: number): Promise<void> {
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      console.log("Emergency alert resolved:", alertId);
    } catch (error) {
      console.error("Error resolving emergency alert:", error);
      throw error;
    }
  }

  async escalateEmergencyAlert(alertId: number): Promise<void> {
    try {
      await api.post(`/alerts/${alertId}/escalate`);
      console.log("Emergency alert escalated:", alertId);
    } catch (error) {
      console.error("Error escalating emergency alert:", error);
      throw error;
    }
  }
}

export const ownerService = new OwnerService();
export default ownerService;
