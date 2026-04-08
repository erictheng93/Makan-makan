<template>
  <div class="backup-monitoring">
    <div class="monitoring-header">
      <h1>{{ t("backup.monitoring.title") }}</h1>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="refreshData"
        >
          {{ t("backup.actions.refresh") }}
        </button>
      </div>
    </div>

    <!-- System Health Overview -->
    <div class="health-overview">
      <div
        class="health-card"
        :class="overallHealthClass"
        :data-health-status="systemHealth?.overall_status || 'unknown'"
      >
        <div class="health-header">
          <h2>{{ t("backup.monitoring.systemHealth") }}</h2>
          <div class="health-status">
            <component :is="healthIcon" :class="healthIconClass" />
            <span class="status-text">{{
              t(`backup.health.${systemHealth?.overall_status || "unknown"}`)
            }}</span>
          </div>
        </div>

        <div class="health-metrics">
          <div class="metric-group">
            <div class="metric">
              <span class="metric-value">{{
                systemHealth?.total_restaurants || 0
              }}</span>
              <span class="metric-label">{{
                t("backup.monitoring.totalRestaurants")
              }}</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{
                systemHealth?.active_configurations || 0
              }}</span>
              <span class="metric-label">{{
                t("backup.monitoring.activeConfigs")
              }}</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{
                systemHealth?.running_backups || 0
              }}</span>
              <span class="metric-label">{{
                t("backup.monitoring.runningBackups")
              }}</span>
            </div>
            <div class="metric">
              <span class="metric-value">{{
                systemHealth?.failed_backups_24h || 0
              }}</span>
              <span class="metric-label">{{
                t("backup.monitoring.failed24h")
              }}</span>
            </div>
          </div>

          <div v-if="systemHealth?.storage_usage" class="storage-info">
            <h3>{{ t("backup.monitoring.storageUsage") }}</h3>
            <div class="storage-bar">
              <div
                class="storage-fill"
                :style="{
                  width: systemHealth.storage_usage.usage_percentage + '%',
                }"
              ></div>
            </div>
            <div class="storage-details">
              <span>{{
                formatBytes(systemHealth.storage_usage.total_bytes)
              }}</span>
              <span
                >{{ systemHealth.storage_usage.usage_percentage.toFixed(1) }}%
                used</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Metrics Chart -->
    <div class="performance-section">
      <div class="chart-card">
        <h3>{{ t("backup.monitoring.performanceTrends") }}</h3>
        <div class="chart-controls">
          <select v-model="selectedPeriod" @change="loadPerformanceData">
            <option value="24h">{{ t("backup.monitoring.last24h") }}</option>
            <option value="7d">{{ t("backup.monitoring.last7days") }}</option>
            <option value="30d">{{ t("backup.monitoring.last30days") }}</option>
          </select>
        </div>

        <div v-if="performanceData.length > 0" class="chart-container">
          <canvas ref="performanceChart" width="800" height="300"></canvas>
        </div>

        <div v-else class="empty-chart">
          <p>{{ t("backup.monitoring.noPerformanceData") }}</p>
        </div>
      </div>
    </div>

    <!-- Restaurant Status Grid -->
    <div class="restaurants-section">
      <div class="section-header">
        <h3>{{ t("backup.monitoring.restaurantStatus") }}</h3>
        <div class="filter-controls">
          <select v-model="statusFilter" @change="filterRestaurants">
            <option value="all">
              {{ t("backup.monitoring.allRestaurants") }}
            </option>
            <option value="healthy">
              {{ t("backup.monitoring.healthyOnly") }}
            </option>
            <option value="issues">
              {{ t("backup.monitoring.withIssues") }}
            </option>
          </select>
        </div>
      </div>

      <div class="restaurants-grid">
        <div
          v-for="restaurant in filteredRestaurants"
          :key="restaurant.id"
          class="restaurant-card"
          :class="getRestaurantStatusClass(restaurant)"
        >
          <div class="restaurant-header">
            <h4>{{ restaurant.name }}</h4>
            <div class="status-indicator" :class="restaurant.status">
              <span class="status-dot"></span>
              <span class="status-text">{{
                t(`backup.monitoring.${restaurant.status}`)
              }}</span>
            </div>
          </div>

          <div class="restaurant-metrics">
            <div class="metric-row">
              <span class="metric-label">{{
                t("backup.monitoring.lastBackup")
              }}</span>
              <span class="metric-value">{{
                formatDate(restaurant.last_backup_at)
              }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">{{
                t("backup.monitoring.successRate")
              }}</span>
              <span class="metric-value">{{ restaurant.success_rate }}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">{{
                t("backup.monitoring.totalBackups")
              }}</span>
              <span class="metric-value">{{ restaurant.total_backups }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">{{
                t("backup.monitoring.storageUsed")
              }}</span>
              <span class="metric-value">{{
                formatBytes(restaurant.storage_used)
              }}</span>
            </div>
          </div>

          <div class="restaurant-actions">
            <button
              class="btn btn-sm btn-primary"
              @click="viewRestaurantDetails(restaurant.id)"
            >
              {{ t("backup.monitoring.viewDetails") }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Critical Alerts -->
    <div v-if="criticalAlerts.length > 0" class="alerts-section">
      <div class="section-header">
        <h3>{{ t("backup.monitoring.criticalAlerts") }}</h3>
        <span class="alert-count">{{ criticalAlerts.length }}</span>
      </div>

      <div class="alerts-list">
        <div
          v-for="alert in criticalAlerts"
          :key="alert.id"
          class="alert-item"
          :class="'severity-' + alert.severity"
        >
          <div class="alert-icon">
            <ExclamationTriangleIcon v-if="alert.severity === 'critical'" />
            <ExclamationCircleIcon v-else />
          </div>
          <div class="alert-content">
            <div class="alert-title">{{ alert.title }}</div>
            <div class="alert-message">{{ alert.message }}</div>
            <div class="alert-meta">
              <span>{{ formatDate(alert.triggered_at) }}</span>
              <span v-if="alert.related_backup_id">
                {{ t("backup.monitoring.relatedBackup") }}:
                {{ alert.related_backup_id.slice(0, 8) }}...
              </span>
            </div>
          </div>
          <div class="alert-actions">
            <button
              v-if="!alert.acknowledged"
              class="btn btn-sm btn-secondary"
              @click="acknowledgeAlert(alert.id)"
            >
              {{ t("backup.monitoring.acknowledge") }}
            </button>
            <button
              v-if="!alert.resolved"
              class="btn btn-sm btn-primary"
              @click="resolveAlert(alert.id)"
            >
              {{ t("backup.monitoring.resolve") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useBackupStore } from "@/stores/backup";
import { api } from "@/services/api";

// Temporary type definitions
interface BackupSystemHealth {
  overall_status: "healthy" | "warning" | "critical";
  total_restaurants: number;
  active_configurations: number;
  running_backups: number;
  failed_backups_24h: number;
  storage_usage: {
    total_bytes: number;
    available_bytes: number;
    usage_percentage: number;
  };
  performance_metrics: {
    average_backup_duration_minutes: number;
    average_success_rate_percentage: number;
    average_compression_ratio: number;
  };
  alerts_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface BackupAlert {
  id: string;
  restaurant_id: string;
  alert_type:
    | "backup_failed"
    | "storage_quota_exceeded"
    | "schedule_missed"
    | "restoration_completed"
    | "performance_degraded";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  related_backup_id?: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";

const { t } = useI18n();
const router = useRouter();
const backupStore = useBackupStore();

// Reactive data
const isLoading = ref(false);
const systemHealth = ref<BackupSystemHealth | null>(null);
const performanceData = ref<any[]>([]);
const restaurants = ref<any[]>([]);
const criticalAlerts = ref<BackupAlert[]>([]);
const selectedPeriod = ref("7d");
const statusFilter = ref("all");

// Chart reference
const performanceChart = ref<HTMLCanvasElement>();

// Computed properties
const overallHealthClass = computed(() => {
  const status = systemHealth.value?.overall_status;
  return {
    "health-healthy": status === "healthy",
    "health-warning": status === "warning",
    "health-critical": status === "critical",
  };
});

const healthIcon = computed(() => {
  const status = systemHealth.value?.overall_status;
  switch (status) {
    case "healthy":
      return CheckCircleIcon;
    case "warning":
      return ExclamationTriangleIcon;
    case "critical":
      return XCircleIcon;
    default:
      return ExclamationCircleIcon;
  }
});

const healthIconClass = computed(() => {
  const status = systemHealth.value?.overall_status;
  return {
    "text-green-500": status === "healthy",
    "text-yellow-500": status === "warning",
    "text-red-500": status === "critical",
    "text-gray-500": !status,
  };
});

const filteredRestaurants = computed(() => {
  if (statusFilter.value === "all") return restaurants.value;
  if (statusFilter.value === "healthy") {
    return restaurants.value.filter((r) => r.status === "healthy");
  }
  if (statusFilter.value === "issues") {
    return restaurants.value.filter((r) => r.status !== "healthy");
  }
  return restaurants.value;
});

// Methods
const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (diffHours < 1) return t("backup.monitoring.justNow");
  if (diffHours < 24)
    return t("backup.monitoring.hoursAgo", { hours: diffHours });
  if (diffHours < 48) return t("backup.monitoring.yesterday");

  return date.toLocaleDateString();
};

const getRestaurantStatusClass = (restaurant: any) => {
  return {
    "status-healthy": restaurant.status === "healthy",
    "status-warning": restaurant.status === "warning",
    "status-critical": restaurant.status === "critical",
  };
};

const refreshData = async () => {
  if (isLoading.value) return;

  isLoading.value = true;

  try {
    // Load system health and restaurants first
    await Promise.all([loadSystemHealth(), loadRestaurants()]);
    // Then load data that depends on restaurant list
    await Promise.all([loadPerformanceData(), loadCriticalAlerts()]);
  } catch (error) {
    console.error("Error refreshing monitoring data:", error);
  } finally {
    isLoading.value = false;
  }
};

const loadSystemHealth = async () => {
  try {
    systemHealth.value = await backupStore.getSystemHealth();
  } catch (error) {
    console.error("Error loading system health:", error);
  }
};

const loadPerformanceData = async () => {
  try {
    const now = new Date();
    const periodDays =
      selectedPeriod.value === "24h"
        ? 1
        : selectedPeriod.value === "7d"
          ? 7
          : 30;
    const dateFrom = new Date(
      now.getTime() - periodDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Fetch backups from all restaurants in parallel
    const results = await Promise.all(
      restaurants.value.map((r) =>
        backupStore
          .listBackups({
            restaurant_id: r.id,
            date_from: dateFrom,
            date_to: now.toISOString(),
            limit: 500,
            sort_by: "created_at",
            sort_order: "asc",
          })
          .catch(() => [] as any[]),
      ),
    );
    const allBackups = results.flat();

    // Group by day and compute success rates
    const dayMap = new Map<string, { total: number; success: number }>();
    for (const backup of allBackups) {
      const day = new Date(backup.created_at).toISOString().split("T")[0];
      const entry = dayMap.get(day) || { total: 0, success: 0 };
      entry.total++;
      if (backup.status === "completed") entry.success++;
      dayMap.set(day, entry);
    }

    performanceData.value = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, stats]) => ({
        timestamp: new Date(day),
        value: stats.total > 0 ? (stats.success / stats.total) * 100 : 100,
      }));

    await nextTick();
    if (performanceChart.value) {
      renderPerformanceChart();
    }
  } catch (error) {
    console.error("Error loading performance data:", error);
  }
};

const loadRestaurants = async () => {
  try {
    const response = await api.get("/restaurants");
    const rawData = response.data?.data || response.data;
    const restaurantList: any[] = Array.isArray(rawData) ? rawData : [];

    const restaurantsWithMetrics = await Promise.all(
      restaurantList.map(async (r: any) => {
        try {
          const metrics = await backupStore.getRestaurantMetrics(r.id, "week");
          const successRate =
            metrics.total_backups > 0
              ? Math.round(
                  (metrics.successful_backups / metrics.total_backups) * 100,
                )
              : 100;

          let status: "healthy" | "warning" | "critical" = "healthy";
          if (successRate < 80 || metrics.failed_backups > 3) {
            status = "critical";
          } else if (successRate < 95 || metrics.failed_backups > 0) {
            status = "warning";
          }

          return {
            id: r.id,
            name: r.name,
            status,
            last_backup_at: metrics.last_backup_at || new Date().toISOString(),
            success_rate: successRate,
            total_backups: metrics.total_backups || 0,
            storage_used: metrics.total_storage_used || 0,
          };
        } catch {
          return {
            id: r.id,
            name: r.name,
            status: "critical" as const,
            last_backup_at: "",
            success_rate: 0,
            total_backups: 0,
            storage_used: 0,
          };
        }
      }),
    );

    restaurants.value = restaurantsWithMetrics;
  } catch (error) {
    console.error("Error loading restaurants:", error);
  }
};

const loadCriticalAlerts = async () => {
  try {
    const allAlerts: BackupAlert[] = [];
    for (const restaurant of restaurants.value) {
      try {
        const alerts = await backupStore.getRestaurantAlerts(
          restaurant.id,
          true,
        );
        allAlerts.push(...alerts);
      } catch {
        // Skip restaurants where alerts are unavailable
      }
    }
    criticalAlerts.value = allAlerts
      .filter((a) => !a.resolved)
      .sort((a, b) => {
        const severityOrder: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const diff =
          (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
        if (diff !== 0) return diff;
        return (
          new Date(b.triggered_at).getTime() -
          new Date(a.triggered_at).getTime()
        );
      });
  } catch (error) {
    console.error("Error loading critical alerts:", error);
  }
};

const filterRestaurants = () => {
  // Filtering is handled by computed property
};

const viewRestaurantDetails = (restaurantId: string) => {
  router.push(`/backup/restaurant/${restaurantId}`);
};

const acknowledgeAlert = async (alertId: string) => {
  try {
    await backupStore.acknowledgeAlert(alertId);
    await loadCriticalAlerts();
  } catch (error) {
    console.error("Error acknowledging alert:", error);
  }
};

const resolveAlert = async (alertId: string) => {
  try {
    await backupStore.resolveAlert(alertId);
    await loadCriticalAlerts();
  } catch (error) {
    console.error("Error resolving alert:", error);
  }
};

// Chart rendering
const renderPerformanceChart = () => {
  const canvas = performanceChart.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Simple line chart implementation
  // In production, use a proper charting library like Chart.js
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw axes and data points
  // This is a simplified implementation
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.beginPath();

  performanceData.value.forEach((point, index) => {
    const x = (index / (performanceData.value.length - 1)) * canvas.width;
    const y = canvas.height - (point.value / 100) * canvas.height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
};

// Lifecycle
onMounted(() => {
  refreshData();
});
</script>

<style scoped>
.backup-monitoring {
  padding: 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

.monitoring-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.monitoring-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
}

/* Health Overview */
.health-overview {
  margin-bottom: 2rem;
}

.health-card {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid transparent;
}

.health-card.health-healthy {
  border-color: #10b981;
}

.health-card.health-warning {
  border-color: #f59e0b;
}

.health-card.health-critical {
  border-color: #ef4444;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.health-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-text {
  font-size: 1.125rem;
  font-weight: 600;
}

.health-metrics {
  display: grid;
  gap: 2rem;
}

.metric-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.metric {
  text-align: center;
}

.metric-value {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
}

.metric-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.5rem;
}

.storage-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1rem 0;
}

.storage-bar {
  height: 0.5rem;
  background: #f3f4f6;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.storage-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.storage-details {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Performance Section */
.performance-section {
  margin-bottom: 2rem;
}

.chart-card {
  background: white;
  border-radius: 0.75rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1rem 0;
}

.chart-controls {
  margin-bottom: 2rem;
}

.chart-controls select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
}

.chart-container {
  position: relative;
  height: 300px;
}

.empty-chart {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

/* Restaurants Section */
.restaurants-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.filter-controls select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
}

.restaurants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.restaurant-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #e5e7eb;
}

.restaurant-card.status-healthy {
  border-left-color: #10b981;
}

.restaurant-card.status-warning {
  border-left-color: #f59e0b;
}

.restaurant-card.status-critical {
  border-left-color: #ef4444;
}

.restaurant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.restaurant-header h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-indicator.healthy .status-dot {
  background: #10b981;
}

.status-indicator.warning .status-dot {
  background: #f59e0b;
}

.status-indicator.critical .status-dot {
  background: #ef4444;
}

.restaurant-metrics {
  margin-bottom: 1rem;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.metric-row .metric-label {
  color: #6b7280;
}

.metric-row .metric-value {
  font-weight: 500;
  color: #1a1a1a;
}

/* Alerts Section */
.alerts-section {
  margin-bottom: 2rem;
}

.alert-count {
  background: #ef4444;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-item {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  border-left: 4px solid #e5e7eb;
}

.alert-item.severity-critical {
  border-left-color: #ef4444;
}

.alert-item.severity-high {
  border-left-color: #f59e0b;
}

.alert-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  color: #ef4444;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
}

.alert-message {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.alert-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
}

/* Common styles */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
