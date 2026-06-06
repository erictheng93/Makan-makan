export type OwnerSystemStatus = "healthy" | "warning" | "error";

type MonitoringComponentStatus = "healthy" | "warning" | "critical" | "down";

export interface OwnerHealthStatusPayload {
  overall: MonitoringComponentStatus;
  components: {
    api?: {
      status: MonitoringComponentStatus;
      latency?: number;
      errorRate?: number;
      lastCheck: number;
      issues: string[];
    };
    database?: {
      status: MonitoringComponentStatus;
      latency?: number;
      errorRate?: number;
      lastCheck: number;
      issues: string[];
    };
    cache?: {
      status: MonitoringComponentStatus;
      lastCheck: number;
      issues: string[];
      metrics?: Record<string, number>;
    };
    external?: {
      status: MonitoringComponentStatus;
      lastCheck: number;
      issues: string[];
    };
  };
  uptime: number;
  version: string;
  timestamp: number;
}

interface LegacyHealthStatusPayload {
  status: string;
}

interface ResolveOwnerSystemHealthOptions {
  healthData: OwnerHealthStatusPayload | LegacyHealthStatusPayload | null;
  tableTotal: number;
  todayOrders: number;
}

export interface OwnerSystemHealthStatuses {
  api: OwnerSystemStatus;
  database: OwnerSystemStatus;
  realtime: OwnerSystemStatus;
}

function isCurrentHealthPayload(
  healthData: ResolveOwnerSystemHealthOptions["healthData"],
): healthData is OwnerHealthStatusPayload {
  return (
    typeof healthData === "object" &&
    healthData !== null &&
    "components" in healthData
  );
}

function toOwnerSystemStatus(
  status: MonitoringComponentStatus | undefined,
): OwnerSystemStatus {
  if (status === "healthy") {
    return "healthy";
  }

  if (status === "critical" || status === "down") {
    return "error";
  }

  return "warning";
}

export function resolveOwnerSystemHealth({
  healthData,
  tableTotal,
  todayOrders,
}: ResolveOwnerSystemHealthOptions): OwnerSystemHealthStatuses {
  if (isCurrentHealthPayload(healthData)) {
    const api = toOwnerSystemStatus(healthData.components.api?.status);
    return {
      api,
      database: toOwnerSystemStatus(healthData.components.database?.status),
      realtime: api,
    };
  }

  const api = healthData?.status === "ok" ? "healthy" : "warning";
  const database = tableTotal > 0 || todayOrders > 0 ? "healthy" : "warning";

  return {
    api,
    database,
    realtime: api,
  };
}
