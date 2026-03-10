<template>
  <div class="scheduling-analytics-view">
    <!-- 頁面標題 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <span class="title-icon">📊</span>
          排班數據分析
        </h1>
        <p class="page-subtitle">全面掌握排班數據與員工工作狀態</p>
      </div>
      <div class="header-actions">
        <button class="action-btn refresh-btn" @click="refreshAllData">
          <span class="btn-icon">🔄</span>
          刷新數據
        </button>
        <button class="action-btn export-btn" @click="exportReport">
          <span class="btn-icon">📥</span>
          匯出報告
        </button>
      </div>
    </div>

    <!-- 快速統計卡片 -->
    <div class="quick-stats">
      <div v-for="(stat, index) in quickStats" :key="index" class="stat-card">
        <div
          class="stat-icon"
          :style="{ backgroundColor: stat.color + '20', color: stat.color }"
        >
          {{ stat.icon }}
        </div>
        <div class="stat-content">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-change" :class="stat.trend">
            <span class="change-icon">{{ stat.changeIcon }}</span>
            <span>{{ stat.change }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表網格 -->
    <div class="charts-grid">
      <!-- 工時分析圖表 -->
      <div class="chart-section full-width">
        <WorkHoursChart :auto-fetch="true" />
      </div>

      <!-- 班別分布和趨勢圖表 -->
      <div class="chart-section">
        <ShiftDistributionChart :auto-fetch="true" />
      </div>

      <div class="chart-section">
        <TrendChart :auto-fetch="true" />
      </div>

      <!-- 數據洞察面板 -->
      <div class="chart-section full-width">
        <div class="analysis-panel">
          <h3 class="panel-title">
            <span class="icon">💡</span>
            數據洞察
          </h3>
          <div class="insights-grid">
            <div
              v-for="insight in insights"
              :key="insight.id"
              class="insight-card"
            >
              <div
                class="insight-icon"
                :style="{ backgroundColor: insight.color }"
              >
                {{ insight.icon }}
              </div>
              <div class="insight-content">
                <h4 class="insight-title">{{ insight.title }}</h4>
                <p class="insight-description">{{ insight.description }}</p>
              </div>
              <div class="insight-action">
                <button
                  class="view-detail-btn"
                  @click="viewInsightDetail(insight)"
                >
                  查看詳情
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import WorkHoursChart from "@/components/charts/WorkHoursChart.vue";
import ShiftDistributionChart from "@/components/charts/ShiftDistributionChart.vue";
import TrendChart from "@/components/charts/TrendChart.vue";

// 快速統計數據
const quickStats = ref([
  {
    icon: "👥",
    label: "活躍員工",
    value: "48",
    change: "+12%",
    changeIcon: "↗",
    trend: "positive",
    color: "#3b82f6",
  },
  {
    icon: "⏰",
    label: "總排班時數",
    value: "1,245h",
    change: "+8.5%",
    changeIcon: "↗",
    trend: "positive",
    color: "#10b981",
  },
  {
    icon: "📅",
    label: "本週排班",
    value: "156",
    change: "-3.2%",
    changeIcon: "↘",
    trend: "negative",
    color: "#f59e0b",
  },
  {
    icon: "⚡",
    label: "換班請求",
    value: "12",
    change: "+25%",
    changeIcon: "↗",
    trend: "warning",
    color: "#ef4444",
  },
]);

// 數據洞察
const insights = ref([
  {
    id: 1,
    icon: "📈",
    title: "工時分布不均",
    description:
      "部分員工工時超過平均值 20%，建議重新調配班次以達到更好的工作平衡",
    color: "#3b82f6",
  },
  {
    id: 2,
    icon: "⚠️",
    title: "週末人力不足",
    description: "週末班次填補率僅 75%，需要增加週末排班或考慮激勵措施",
    color: "#f59e0b",
  },
  {
    id: 3,
    icon: "💡",
    title: "夜班優化建議",
    description: "夜班員工流動率較高，建議提供額外津貼或調整工作時長",
    color: "#10b981",
  },
  {
    id: 4,
    icon: "🎯",
    title: "高效時段分析",
    description:
      "午班時段 (12:00-20:00) 效率最高，可以考慮增加此時段的人力配置",
    color: "#8b5cf6",
  },
]);

// 刷新所有數據
const refreshAllData = () => {
  console.log("Refreshing all data...");
  // 觸發所有圖表的數據刷新
  window.location.reload();
};

// 匯出報告
const exportReport = () => {
  console.log("Exporting report...");

  // 準備報告數據
  const reportData = {
    generated: new Date().toISOString(),
    stats: quickStats.value,
    insights: insights.value,
  };

  // 轉換為 JSON 並下載
  const dataStr = JSON.stringify(reportData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `scheduling-analytics-${new Date().toISOString().split("T")[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
};

// 查看洞察詳情
const viewInsightDetail = (insight: any) => {
  console.log("Viewing insight:", insight);
  alert(`查看洞察詳情：\n\n${insight.title}\n\n${insight.description}`);
};

onMounted(() => {
  console.log("Scheduling Analytics View mounted");
});
</script>

<style scoped>
.scheduling-analytics-view {
  padding: 24px;
  background: #f9fafb;
  min-height: 100vh;
}

/* 頁面標題 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.header-content {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 32px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.title-icon {
  font-size: 36px;
}

.page-subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn {
  background: #f3f4f6;
  color: #374151;
}

.refresh-btn:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.export-btn {
  background: #3b82f6;
  color: white;
}

.export-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-icon {
  font-size: 16px;
}

/* 快速統計卡片 */
.quick-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 28px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.stat-change.positive {
  color: #10b981;
}

.stat-change.negative {
  color: #ef4444;
}

.stat-change.warning {
  color: #f59e0b;
}

.change-icon {
  font-size: 14px;
}

/* 圖表網格 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.chart-section {
  animation: fadeIn 0.5s ease-in-out;
}

.chart-section.full-width {
  grid-column: 1 / -1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 分析面板 */
.analysis-panel {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 20px 0;
}

.panel-title .icon {
  font-size: 24px;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.insight-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border-left: 4px solid #3b82f6;
  transition: all 0.2s;
}

.insight-card:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.insight-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 24px;
  color: white;
  flex-shrink: 0;
}

.insight-content {
  flex: 1;
  min-width: 0;
}

.insight-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.insight-description {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

.insight-action {
  display: flex;
  align-items: center;
}

.view-detail-btn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.view-detail-btn:hover {
  background: white;
  border-color: #3b82f6;
  color: #3b82f6;
}

/* 響應式設計 */
@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }

  .chart-section.full-width {
    grid-column: auto;
  }
}

@media (max-width: 768px) {
  .scheduling-analytics-view {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .action-btn {
    flex: 1;
  }

  .quick-stats {
    grid-template-columns: 1fr;
  }

  .insights-grid {
    grid-template-columns: 1fr;
  }

  .insight-card {
    flex-direction: column;
  }

  .view-detail-btn {
    width: 100%;
  }
}
</style>
