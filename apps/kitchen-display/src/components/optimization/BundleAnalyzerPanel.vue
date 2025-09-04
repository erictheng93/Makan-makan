<template>
  <!-- Bundle Performance Analyzer Panel -->
  <div class="bg-white rounded-xl shadow-lg overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div
            class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center"
          >
            <ChartBarIcon class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">效能優化分析</h3>
            <p class="text-purple-100 text-sm">代碼包大小與載入效能監控</p>
          </div>
        </div>

        <!-- Refresh Button -->
        <button
          :disabled="analyzing"
          class="relative inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-purple-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          @click="refreshAnalysis"
        >
          <ArrowPathIcon
            :class="['w-4 h-4 mr-2', analyzing && 'animate-spin']"
          />
          {{ analyzing ? "分析中..." : "重新分析" }}
        </button>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Performance Score -->
      <div class="text-center">
        <div class="relative inline-flex">
          <svg class="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              stroke-width="8"
              fill="none"
              class="text-gray-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              stroke-width="8"
              fill="none"
              :stroke-dasharray="`${2 * Math.PI * 56}`"
              :stroke-dashoffset="`${2 * Math.PI * 56 * (1 - analysis.score / 100)}`"
              :class="getScoreColor(analysis.score)"
              class="transition-all duration-1000 ease-out"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900">
                {{ Math.round(analysis.score) }}
              </div>
              <div class="text-sm text-gray-500">分數</div>
            </div>
          </div>
        </div>
        <div class="mt-2">
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="getScoreBadgeClass(analysis.score)"
          >
            {{ getScoreLabel(analysis.score) }}
          </span>
        </div>
      </div>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Bundle Size -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">代碼包大小</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ formatBytes(analysis.metrics.bundleSize) }}
              </p>
            </div>
            <div
              class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"
            >
              <ArchiveBoxIcon class="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width:
                    Math.min(
                      (analysis.metrics.bundleSize / (2 * 1024 * 1024)) * 100,
                      100,
                    ) + '%',
                }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">目標: &lt; 2MB</p>
          </div>
        </div>

        <!-- Load Time -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">載入時間</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ (analysis.metrics.loadTime / 1000).toFixed(1) }}s
              </p>
            </div>
            <div
              class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"
            >
              <ClockIcon class="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-green-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width:
                    Math.min((analysis.metrics.loadTime / 5000) * 100, 100) +
                    '%',
                }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">目標: &lt; 3s</p>
          </div>
        </div>

        <!-- Memory Usage -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">內存使用</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ formatBytes(analysis.metrics.memoryUsage) }}
              </p>
            </div>
            <div
              class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center"
            >
              <CpuChipIcon class="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-yellow-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width:
                    Math.min(
                      (analysis.metrics.memoryUsage / (100 * 1024 * 1024)) *
                        100,
                      100,
                    ) + '%',
                }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">目標: &lt; 50MB</p>
          </div>
        </div>

        <!-- Resource Count -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">資源文件</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ analysis.metrics.resourceCount }}
              </p>
            </div>
            <div
              class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"
            >
              <DocumentDuplicateIcon class="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width:
                    Math.min(
                      (analysis.metrics.resourceCount / 150) * 100,
                      100,
                    ) + '%',
                }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">目標: &lt; 100</p>
          </div>
        </div>

        <!-- Render Time -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">渲染時間</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ analysis.metrics.renderTime.toFixed(1) }}ms
              </p>
            </div>
            <div
              class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"
            >
              <PaintBrushIcon class="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-purple-600 h-2 rounded-full transition-all duration-500"
                :style="{
                  width:
                    Math.min((analysis.metrics.renderTime / 50) * 100, 100) +
                    '%',
                }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">目標: &lt; 16ms (60fps)</p>
          </div>
        </div>

        <!-- Cache Stats -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">快取效率</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ cacheHitRate }}%
              </p>
            </div>
            <div
              class="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center"
            >
              <ServerIcon class="w-5 h-5 text-teal-600" />
            </div>
          </div>
          <div class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-teal-600 h-2 rounded-full transition-all duration-500"
                :style="{ width: cacheHitRate + '%' }"
              />
            </div>
            <p class="text-xs text-gray-500 mt-1">
              快取: {{ cacheStats.componentsCached }} 組件
            </p>
          </div>
        </div>
      </div>

      <!-- Optimization Recommendations -->
      <div v-if="analysis.recommendations.length > 0">
        <h4 class="text-lg font-medium text-gray-900 mb-4">優化建議</h4>
        <div class="space-y-3">
          <div
            v-for="(recommendation, index) in analysis.recommendations"
            :key="index"
            class="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <ExclamationTriangleIcon
              class="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0"
            />
            <p class="text-sm text-yellow-800">
              {{ recommendation }}
            </p>
          </div>
        </div>
      </div>

      <!-- Chunk Information -->
      <div>
        <h4 class="text-lg font-medium text-gray-900 mb-4">代碼分割狀態</h4>
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p class="font-medium text-gray-600">已預載入</p>
              <p class="text-lg font-bold text-green-600">
                {{ cacheStats.preloadedChunks }}
              </p>
            </div>
            <div>
              <p class="font-medium text-gray-600">載入中</p>
              <p class="text-lg font-bold text-blue-600">
                {{ cacheStats.loadingChunks }}
              </p>
            </div>
            <div>
              <p class="font-medium text-gray-600">已快取組件</p>
              <p class="text-lg font-bold text-purple-600">
                {{ cacheStats.componentsCached }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Panel -->
      <div>
        <h4 class="text-lg font-medium text-gray-900 mb-4">優化配置</h4>
        <div class="space-y-3">
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">啟用延遲載入</span>
            <input
              v-model="config.enableLazyLoading"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="updateConfiguration"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">啟用 Service Worker</span>
            <input
              v-model="config.enableServiceWorker"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="updateConfiguration"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">啟用圖片優化</span>
            <input
              v-model="config.enableImageOptimization"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="updateConfiguration"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">啟用組件快取</span>
            <input
              v-model="config.enableComponentCache"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="updateConfiguration"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  ChartBarIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentDuplicateIcon,
  PaintBrushIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { performanceOptimizationService } from "@/services/performanceOptimizationService";
import type { OptimizationConfig } from "@/services/performanceOptimizationService";

// Reactive data
const analyzing = ref(false);
const analysis = ref({
  score: 0,
  recommendations: [] as string[],
  metrics: {
    bundleSize: 0,
    loadTime: 0,
    memoryUsage: 0,
    renderTime: 0,
    resourceCount: 0,
    cachedResources: 0,
  },
});

const config = ref<OptimizationConfig>({
  enableLazyLoading: true,
  enableServiceWorker: true,
  enableResourceHints: true,
  enableImageOptimization: true,
  enableComponentCache: true,
  chunkPreloadThreshold: 0.5,
});

// Computed properties
const performanceMetrics = performanceOptimizationService.performanceMetrics;
const cacheStats = performanceOptimizationService.cacheStats;
const optimizationConfig = performanceOptimizationService.optimizationConfig;

const cacheHitRate = computed(() => {
  const total = performanceMetrics.value.resourceCount;
  const cached = performanceMetrics.value.cachedResources;
  return total > 0 ? Math.round((cached / total) * 100) : 0;
});

// Methods
const refreshAnalysis = async () => {
  analyzing.value = true;

  try {
    // Wait a bit to show loading state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Perform bundle analysis
    analysis.value = performanceOptimizationService.analyzeBundlePerformance();
  } catch (error) {
    console.error("Analysis failed:", error);
  } finally {
    analyzing.value = false;
  }
};

const updateConfiguration = () => {
  performanceOptimizationService.updateConfig(config.value);
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
};

const getScoreBadgeClass = (score: number): string => {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const getScoreLabel = (score: number): string => {
  if (score >= 90) return "優秀";
  if (score >= 80) return "良好";
  if (score >= 60) return "普通";
  if (score >= 40) return "需要改善";
  return "急需優化";
};

// Initialize
onMounted(() => {
  config.value = optimizationConfig.value;
  refreshAnalysis();
});
</script>

<style scoped>
/* Custom animations */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Progress bar animations */
.progress-bar {
  transition: width 1s ease-out;
}

/* Score circle animation */
circle {
  transition: stroke-dashoffset 1s ease-out;
}

/* Card hover effects */
.bg-gray-50:hover {
  background-color: rgb(249 250 251);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease-in-out;
}
</style>
