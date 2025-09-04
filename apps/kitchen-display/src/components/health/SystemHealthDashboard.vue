<template>
  <!-- System Health Dashboard -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">系統健康監控</h1>
          <p class="mt-2 text-sm text-gray-600">監控系統運行狀態和性能指標</p>
        </div>

        <div class="flex items-center space-x-3">
          <!-- Monitoring status -->
          <div class="flex items-center">
            <div
              :class="[
                'w-3 h-3 rounded-full mr-2',
                systemHealth.isMonitoring
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-red-500',
              ]"
            />
            <span class="text-sm text-gray-600">
              {{ systemHealth.isMonitoring ? "監控中" : "已停止" }}
            </span>
          </div>

          <!-- Control buttons -->
          <button
            :disabled="runningDiagnostics"
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            @click="runDiagnostics"
          >
            <CpuChipIcon
              :class="['w-4 h-4 mr-2', { 'animate-spin': runningDiagnostics }]"
            />
            {{ runningDiagnostics ? "診斷中..." : "運行診斷" }}
          </button>

          <button
            :disabled="loading"
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            @click="refreshHealthData"
          >
            <ArrowPathIcon
              :class="['w-4 h-4 mr-2', { 'animate-spin': loading }]"
            />
            更新
          </button>
        </div>
      </div>
    </div>

    <!-- Overall Health Status -->
    <div class="mb-8">
      <div class="bg-white overflow-hidden shadow-lg rounded-lg">
        <div class="px-6 py-8">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div
                :class="[
                  'w-16 h-16 rounded-full flex items-center justify-center',
                  getHealthStatusColor(healthReport.overall.status, 'bg'),
                ]"
              >
                <component
                  :is="getHealthStatusIcon(healthReport.overall.status)"
                  class="w-8 h-8 text-white"
                />
              </div>
            </div>
            <div class="ml-6 flex-1">
              <div class="flex items-center">
                <h2 class="text-2xl font-bold text-gray-900">系統健康狀態</h2>
                <span
                  :class="[
                    'ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                    getHealthStatusColor(healthReport.overall.status, 'badge'),
                  ]"
                >
                  {{ getHealthStatusText(healthReport.overall.status) }}
                </span>
              </div>

              <div class="mt-2 flex items-center">
                <div class="flex items-center">
                  <span class="text-3xl font-bold text-gray-900">{{
                    healthReport.overall.score
                  }}</span>
                  <span class="text-lg text-gray-500 ml-1">/100</span>
                </div>
                <div class="ml-6">
                  <div class="text-sm text-gray-500 mb-1">運行時間</div>
                  <div class="text-lg font-semibold text-gray-900">
                    {{ formatUptime(healthReport.uptime) }}
                  </div>
                </div>
                <div class="ml-6">
                  <div class="text-sm text-gray-500 mb-1">最後更新</div>
                  <div class="text-lg font-semibold text-gray-900">
                    {{ formatLastUpdate(healthReport.overall.lastUpdate) }}
                  </div>
                </div>
              </div>

              <!-- Health Score Progress Bar -->
              <div class="mt-4">
                <div class="flex justify-between text-sm text-gray-600 mb-1">
                  <span>健康分數</span>
                  <span>{{ healthReport.overall.score }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    :class="[
                      'h-2 rounded-full transition-all duration-300',
                      healthReport.overall.score >= 80
                        ? 'bg-green-500'
                        : healthReport.overall.score >= 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500',
                    ]"
                    :style="{ width: `${healthReport.overall.score}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Alerts -->
    <div v-if="activeAlerts.length > 0" class="mb-8">
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">活動警報</h3>
        </div>
        <div class="divide-y divide-gray-200">
          <div
            v-for="alert in activeAlerts.slice(0, 5)"
            :key="alert.id"
            class="px-6 py-4"
          >
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <div
                  :class="[
                    'w-2 h-2 rounded-full mt-2',
                    getAlertSeverityColor(alert.severity),
                  ]"
                />
              </div>
              <div class="ml-4 flex-1">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ alert.message }}
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                      {{ alert.component }} •
                      {{ formatRelativeTime(alert.timestamp) }}
                    </p>
                  </div>
                  <button
                    class="ml-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    @click="resolveAlert(alert.id)"
                  >
                    解決
                  </button>
                </div>

                <!-- Recommended Actions -->
                <div v-if="alert.actions.length > 0" class="mt-2">
                  <p class="text-xs text-gray-500 mb-1">建議動作:</p>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="action in alert.actions.slice(0, 3)"
                      :key="action"
                      class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {{ action }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Components Status -->
    <div class="mb-8">
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">系統組件狀態</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          <div
            v-for="component in healthReport.components"
            :key="component.id"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-gray-900">
                {{ component.name }}
              </h4>
              <span
                :class="[
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  getComponentStatusColor(component.status),
                ]"
              >
                {{ getComponentStatusText(component.status) }}
              </span>
            </div>

            <!-- Health Score -->
            <div class="mb-3">
              <div class="flex justify-between text-xs text-gray-600 mb-1">
                <span>健康分數</span>
                <span>{{ component.healthScore }}/100</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  :class="[
                    'h-1.5 rounded-full transition-all duration-300',
                    component.healthScore >= 80
                      ? 'bg-green-500'
                      : component.healthScore >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500',
                  ]"
                  :style="{ width: `${component.healthScore}%` }"
                />
              </div>
            </div>

            <!-- Additional Info -->
            <div class="text-xs text-gray-500 space-y-1">
              <div v-if="component.responseTime">
                響應時間: {{ Math.round(component.responseTime) }}ms
              </div>
              <div>最後檢查: {{ formatRelativeTime(component.lastCheck) }}</div>
              <div v-if="component.dependencies.length > 0">
                依賴: {{ component.dependencies.join(", ") }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Metrics -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Key Metrics -->
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">關鍵指標</h3>
        </div>
        <div class="p-6 space-y-4">
          <div
            v-for="metric in keyMetrics"
            :key="metric.id"
            class="flex items-center justify-between"
          >
            <div class="flex items-center">
              <div
                :class="[
                  'w-3 h-3 rounded-full mr-3',
                  getMetricStatusColor(metric.status),
                ]"
              />
              <div>
                <div class="text-sm font-medium text-gray-900">
                  {{ metric.name }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ metric.description }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="flex items-center">
                <span class="text-lg font-semibold text-gray-900">
                  {{ formatMetricValue(metric.value, metric.unit) }}
                </span>
                <TrendIcon :trend="metric.trend" class="ml-2" />
              </div>
              <div class="text-xs text-gray-500">
                {{ getMetricStatusText(metric.status) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Statistics -->
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">系統統計</h3>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900">
                {{ systemStats.totalAlerts }}
              </div>
              <div class="text-sm text-gray-500">總警報</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-red-600">
                {{ systemStats.criticalAlerts }}
              </div>
              <div class="text-sm text-gray-500">嚴重警報</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">
                {{ systemStats.avgResponseTime }}ms
              </div>
              <div class="text-sm text-gray-500">平均響應</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-yellow-600">
                {{ systemStats.errorRate }}
              </div>
              <div class="text-sm text-gray-500">錯誤率/小時</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    <div v-if="healthReport.recommendations.length > 0" class="mb-8">
      <div class="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg">
        <div class="flex">
          <div class="flex-shrink-0">
            <InformationCircleIcon class="h-5 w-5 text-blue-400" />
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800 mb-2">系統建議</h3>
            <div class="text-sm text-blue-700">
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="recommendation in healthReport.recommendations"
                  :key="recommendation"
                >
                  {{ recommendation }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Diagnostics Modal -->
    <div
      v-if="showDiagnostics"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">系統診斷結果</h3>
          <button
            class="text-gray-400 hover:text-gray-600"
            @click="showDiagnostics = false"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>

        <div class="space-y-3">
          <div
            v-for="(result, test) in diagnosticsResults"
            :key="test"
            class="flex items-center justify-between p-3 bg-gray-50 rounded"
          >
            <span class="text-sm font-medium text-gray-700">{{
              getDiagnosticName(test)
            }}</span>
            <div class="flex items-center">
              <div
                :class="[
                  'w-3 h-3 rounded-full mr-2',
                  result ? 'bg-green-500' : 'bg-red-500',
                ]"
              />
              <span class="text-sm text-gray-600">{{
                result ? "正常" : "失敗"
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from "vue";
import {
  CpuChipIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import { useToast } from "vue-toastification";
import { systemHealthService } from "@/services/systemHealthService";
import type { SystemHealthReport } from "@/services/systemHealthService";

const toast = useToast();

// State
const loading = ref(false);
const runningDiagnostics = ref(false);
const showDiagnostics = ref(false);
const diagnosticsResults = ref<Record<string, boolean>>({});

// Data
const systemHealth = computed(() => systemHealthService);
const healthReport = computed((): SystemHealthReport => {
  try {
    return systemHealthService.getHealthReport();
  } catch (error) {
    console.error("Failed to get health report:", error);
    return {
      overall: { status: "critical", score: 0, lastUpdate: 0 },
      metrics: [],
      components: [],
      alerts: [],
      recommendations: [],
      uptime: 0,
    };
  }
});

const systemStats = computed(() => systemHealthService.getSystemStats());
const activeAlerts = computed(() => systemHealthService.getActiveAlerts());
const keyMetrics = computed(
  () => healthReport.value.metrics.slice(0, 6), // Show top 6 metrics
);

// Component for trend icons
const TrendIcon = ({
  trend,
  class: className,
}: {
  trend: "up" | "down" | "stable";
  class?: string;
}) => {
  const iconMap: Record<string, any> = {
    up: ArrowTrendingUpIcon,
    down: ArrowTrendingDownIcon,
    stable: MinusIcon,
  };
  const colorMap: Record<string, string> = {
    up: "text-red-500",
    down: "text-green-500",
    stable: "text-gray-400",
  };

  const IconComponent = iconMap[trend];
  return h(IconComponent, {
    class: `w-4 h-4 ${colorMap[trend]} ${className || ""}`,
  });
};

// Methods
const refreshHealthData = async () => {
  loading.value = true;
  try {
    await systemHealthService.performHealthCheck();
    toast.success("健康數據已更新");
  } catch (error) {
    toast.error("更新健康數據失敗");
    console.error("Health data refresh failed:", error);
  } finally {
    loading.value = false;
  }
};

const runDiagnostics = async () => {
  runningDiagnostics.value = true;
  try {
    const results = await systemHealthService.runDiagnostics();
    diagnosticsResults.value = results;
    showDiagnostics.value = true;
    toast.success("系統診斷完成");
  } catch (error) {
    toast.error("系統診斷失敗");
    console.error("Diagnostics failed:", error);
  } finally {
    runningDiagnostics.value = false;
  }
};

const resolveAlert = (alertId: string) => {
  systemHealthService.resolveAlert(alertId);
  toast.success("警報已解決");
};

// Utility functions
const getHealthStatusIcon = (status: string) => {
  const iconMap: Record<string, any> = {
    healthy: CheckCircleIcon,
    warning: ExclamationTriangleIcon,
    critical: XCircleIcon,
  };
  return iconMap[status] || ExclamationTriangleIcon;
};

const getHealthStatusColor = (status: string, type: "bg" | "badge") => {
  const colorMap: Record<string, string> = {
    healthy: type === "bg" ? "bg-green-500" : "bg-green-100 text-green-800",
    warning: type === "bg" ? "bg-yellow-500" : "bg-yellow-100 text-yellow-800",
    critical: type === "bg" ? "bg-red-500" : "bg-red-100 text-red-800",
  };
  return colorMap[status] || colorMap.critical;
};

const getHealthStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    healthy: "健康",
    warning: "警告",
    critical: "嚴重",
  };
  return textMap[status] || "未知";
};

const getAlertSeverityColor = (severity: string) => {
  const colorMap: Record<string, string> = {
    info: "bg-blue-400",
    warning: "bg-yellow-400",
    critical: "bg-red-500",
  };
  return colorMap[severity] || "bg-gray-400";
};

const getComponentStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    online: "bg-green-100 text-green-800",
    degraded: "bg-yellow-100 text-yellow-800",
    offline: "bg-red-100 text-red-800",
  };
  return colorMap[status] || "bg-gray-100 text-gray-800";
};

const getComponentStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    online: "在線",
    degraded: "降級",
    offline: "離線",
  };
  return textMap[status] || "未知";
};

const getMetricStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    healthy: "bg-green-500",
    warning: "bg-yellow-500",
    critical: "bg-red-500",
  };
  return colorMap[status] || "bg-gray-400";
};

const getMetricStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    healthy: "正常",
    warning: "警告",
    critical: "嚴重",
  };
  return textMap[status] || "未知";
};

const formatMetricValue = (value: number, unit: string) => {
  if (unit === "%") {
    return `${Math.round(value)}%`;
  } else if (unit === "ms") {
    return `${Math.round(value)}ms`;
  } else if (unit === "MB") {
    return `${Math.round(value)}MB`;
  }
  return `${Math.round(value)} ${unit}`;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天 ${hours}小時`;
  } else if (hours > 0) {
    return `${hours}小時 ${minutes}分鐘`;
  } else {
    return `${minutes}分鐘`;
  }
};

const formatLastUpdate = (timestamp: number) => {
  if (!timestamp) return "從未";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "剛才";
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分鐘前`;
  } else {
    return new Date(timestamp).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "剛才";
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分鐘前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小時前`;
  } else {
    return `${Math.floor(diff / 86400000)}天前`;
  }
};

const getDiagnosticName = (test: string) => {
  const nameMap: Record<string, string> = {
    networkConnectivity: "網路連線",
    localStorage: "本地儲存",
    webWorkers: "Web Workers",
    audioContext: "音頻上下文",
    performance: "性能API",
    permissions: "權限API",
    browserCompatibility: "瀏覽器兼容性",
  };
  return nameMap[test] || test;
};

// Auto refresh setup
let refreshInterval: NodeJS.Timeout | null = null;

onMounted(() => {
  // Start health monitoring if not already started
  if (!systemHealthService.isMonitoring.value) {
    systemHealthService.start();
  }

  // Setup auto refresh
  refreshInterval = setInterval(refreshHealthData, 30000); // Every 30 seconds
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
/* Animation for health status */
@keyframes pulse-health {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse-health {
  animation: pulse-health 2s ease-in-out infinite;
}

/* Custom scrollbar for modal */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
