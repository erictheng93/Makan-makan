<template>
  <div class="performance-dashboard">
    <div class="dashboard-header">
      <h2>Performance Monitoring</h2>
      <div class="header-actions">
        <button class="btn-secondary" :disabled="isRefreshing" @click="refresh">
          <span v-if="isRefreshing">Refreshing...</span>
          <span v-else>Refresh</span>
        </button>
        <button class="btn-primary" @click="exportReport">Export Report</button>
      </div>
    </div>

    <!-- Performance Score Card -->
    <div class="score-card" :class="`grade-${performanceGrade.toLowerCase()}`">
      <div class="score-value">{{ performanceScore }}</div>
      <div class="score-grade">Grade: {{ performanceGrade }}</div>
      <div class="score-label">Overall Performance Score</div>
    </div>

    <!-- Web Vitals -->
    <div class="metrics-section">
      <h3>Web Vitals</h3>
      <div class="metrics-grid">
        <div class="metric-card" :class="getVitalStatus('LCP', webVitals.LCP)">
          <div class="metric-label">LCP</div>
          <div class="metric-value">
            {{
              webVitals.LCP ? `${(webVitals.LCP / 1000).toFixed(2)}s` : "N/A"
            }}
          </div>
          <div class="metric-description">Largest Contentful Paint</div>
          <div class="metric-target">Target: &lt; 2.5s</div>
        </div>

        <div class="metric-card" :class="getVitalStatus('FID', webVitals.FID)">
          <div class="metric-label">FID</div>
          <div class="metric-value">
            {{ webVitals.FID ? `${webVitals.FID.toFixed(0)}ms` : "N/A" }}
          </div>
          <div class="metric-description">First Input Delay</div>
          <div class="metric-target">Target: &lt; 100ms</div>
        </div>

        <div class="metric-card" :class="getVitalStatus('CLS', webVitals.CLS)">
          <div class="metric-label">CLS</div>
          <div class="metric-value">
            {{ webVitals.CLS ? webVitals.CLS.toFixed(3) : "N/A" }}
          </div>
          <div class="metric-description">Cumulative Layout Shift</div>
          <div class="metric-target">Target: &lt; 0.1</div>
        </div>

        <div class="metric-card" :class="getVitalStatus('FCP', webVitals.FCP)">
          <div class="metric-label">FCP</div>
          <div class="metric-value">
            {{
              webVitals.FCP ? `${(webVitals.FCP / 1000).toFixed(2)}s` : "N/A"
            }}
          </div>
          <div class="metric-description">First Contentful Paint</div>
          <div class="metric-target">Target: &lt; 1.8s</div>
        </div>

        <div
          class="metric-card"
          :class="getVitalStatus('TTFB', webVitals.TTFB)"
        >
          <div class="metric-label">TTFB</div>
          <div class="metric-value">
            {{ webVitals.TTFB ? `${webVitals.TTFB.toFixed(0)}ms` : "N/A" }}
          </div>
          <div class="metric-description">Time to First Byte</div>
          <div class="metric-target">Target: &lt; 800ms</div>
        </div>

        <div class="metric-card" :class="getVitalStatus('TTI', webVitals.TTI)">
          <div class="metric-label">TTI</div>
          <div class="metric-value">
            {{
              webVitals.TTI ? `${(webVitals.TTI / 1000).toFixed(2)}s` : "N/A"
            }}
          </div>
          <div class="metric-description">Time to Interactive</div>
          <div class="metric-target">Target: &lt; 3.8s</div>
        </div>
      </div>
    </div>

    <!-- Custom Metrics -->
    <div class="metrics-section">
      <h3>Custom Metrics</h3>
      <div class="metrics-table">
        <table v-if="metrics.length > 0">
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Tags</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="metric in recentMetrics"
              :key="`${metric.name}-${metric.timestamp}`"
            >
              <td>{{ metric.name }}</td>
              <td>{{ formatMetricValue(metric) }}</td>
              <td>{{ metric.unit }}</td>
              <td>
                <span v-if="metric.tags" class="tags">
                  <span
                    v-for="(value, key) in metric.tags"
                    :key="key"
                    class="tag"
                  >
                    {{ key }}: {{ value }}
                  </span>
                </span>
              </td>
              <td>{{ formatTimestamp(metric.timestamp) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">No custom metrics recorded yet</div>
      </div>
    </div>

    <!-- Resource Timings -->
    <div class="metrics-section">
      <h3>Slow Resources</h3>
      <div class="resources-list">
        <div v-if="slowResources.length > 0">
          <div
            v-for="resource in slowResources"
            :key="resource.name"
            class="resource-item"
          >
            <div class="resource-name">
              {{ formatResourceName(resource.name) }}
            </div>
            <div class="resource-meta">
              <span class="resource-type">{{ resource.type }}</span>
              <span class="resource-duration"
                >{{ resource.duration.toFixed(0) }}ms</span
              >
              <span v-if="resource.size" class="resource-size">
                {{ formatBytes(resource.size) }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">No slow resources detected</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePerformanceMonitor } from "../composables/usePerformanceMonitor";
import type { PerformanceMetric, ResourceTiming } from "@makanmakan/utils";

const {
  webVitals,
  metrics,
  resources,
  getPerformanceScore,
  getPerformanceGrade,
  generateReport,
} = usePerformanceMonitor();

const isRefreshing = ref(false);

const performanceScore = computed(() => getPerformanceScore());
const performanceGrade = computed(() => getPerformanceGrade());

const recentMetrics = computed(() => {
  return metrics.value
    .slice()
    .sort(
      (a: PerformanceMetric, b: PerformanceMetric) => b.timestamp - a.timestamp,
    )
    .slice(0, 20);
});

const slowResources = computed(() => {
  return resources.value
    .filter((r: ResourceTiming) => r.duration > 1000)
    .sort((a: ResourceTiming, b: ResourceTiming) => b.duration - a.duration)
    .slice(0, 10);
});

function getVitalStatus(metric: string, value?: number): string {
  if (!value) return "unknown";

  const thresholds: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    TTI: { good: 3800, poor: 7300 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return "unknown";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

function formatMetricValue(metric: { value: number; unit: string }): string {
  if (metric.unit === "ms") {
    return metric.value.toFixed(2);
  }
  if (metric.unit === "bytes") {
    return formatBytes(metric.value);
  }
  return metric.value.toString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatResourceName(name: string): string {
  try {
    const url = new URL(name);
    return url.pathname.split("/").pop() || url.pathname;
  } catch {
    return name;
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

async function refresh(): Promise<void> {
  isRefreshing.value = true;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  isRefreshing.value = false;
}

function exportReport(): void {
  const report = generateReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `performance-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.performance-dashboard {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.score-card {
  padding: 32px;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.score-card.grade-a {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.score-card.grade-b {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.score-card.grade-c {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.score-card.grade-d,
.score-card.grade-f {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.score-value {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
}

.score-grade {
  font-size: 24px;
  font-weight: 600;
  margin-top: 8px;
}

.score-label {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 8px;
}

.metrics-section {
  margin-bottom: 32px;
}

.metrics-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-card {
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  background: white;
}

.metric-card.good {
  border-color: #10b981;
  background: #f0fdf4;
}

.metric-card.needs-improvement {
  border-color: #f59e0b;
  background: #fffbeb;
}

.metric-card.poor {
  border-color: #ef4444;
  background: #fef2f2;
}

.metric-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.metric-description {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-target {
  font-size: 12px;
  color: #9ca3af;
}

.metrics-table {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.metrics-table table {
  width: 100%;
  border-collapse: collapse;
}

.metrics-table th {
  background: #f9fafb;
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  border-bottom: 1px solid #e5e7eb;
}

.metrics-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  color: #374151;
}

.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  background: #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  color: #374151;
}

.resources-list {
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.resource-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.resource-item:last-child {
  border-bottom: none;
}

.resource-name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  margin-bottom: 4px;
}

.resource-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.resource-type {
  padding: 2px 8px;
  background: #e5e7eb;
  border-radius: 4px;
  color: #374151;
  text-transform: uppercase;
  font-weight: 600;
}

.resource-duration {
  color: #ef4444;
  font-weight: 600;
}

.resource-size {
  color: #6b7280;
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
</style>
