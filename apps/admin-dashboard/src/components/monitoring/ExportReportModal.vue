<script setup lang="ts">
import { ref, computed } from "vue";
// import { useI18n } from 'vue-i18n' // Reserved for future translations
import {
  XMarkIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
} from "@heroicons/vue/24/outline";
import DocumentChartBarIcon from "@heroicons/vue/24/outline/DocumentChartBarIcon";
import { exportService } from "@/services/exportService";
import type {
  ExportOptions,
  ExportFormat,
  ExportDataType,
  ReportTemplate,
} from "@/types/monitoring-export";
import {
  REPORT_TEMPLATES,
  DEFAULT_EXPORT_OPTIONS,
} from "@/types/monitoring-export";

// Props
interface Props {
  show: boolean;
  data: any[];
  defaultDataType?: ExportDataType;
}

const props = withDefaults(defineProps<Props>(), {
  defaultDataType: "all",
});

// Emits
const emit = defineEmits<{
  close: [];
  exported: [filename: string];
}>();

// I18n - Reserved for future translations
// const { t: _t } = useI18n()

// State
const exportOptions = ref<ExportOptions>({
  ...DEFAULT_EXPORT_OPTIONS,
  dataType: props.defaultDataType,
});
const selectedTemplate = ref<string>("");
const isExporting = ref(false);
const exportProgress = ref(0);

// Format icons
const formatIcons: Record<ExportFormat, any> = {
  csv: TableCellsIcon,
  excel: TableCellsIcon,
  pdf: DocumentChartBarIcon,
};

// Format labels
const formatLabels: Record<ExportFormat, string> = {
  csv: "CSV (逗號分隔值)",
  excel: "Excel (xlsx)",
  pdf: "PDF (可攜式文件)",
};

// Data type labels
const dataTypeLabels: Record<ExportDataType, string> = {
  alerts: "警報記錄",
  performance: "性能指標",
  errors: "錯誤日誌",
  health: "健康狀態",
  all: "完整數據",
};

// Computed
const formatOptions: ExportFormat[] = ["csv", "excel", "pdf"];

const estimatedSize = computed(() => {
  const avgRowSize: Record<ExportFormat, number> = {
    csv: 200,
    excel: 300,
    pdf: 500,
  };
  const size = props.data.length * avgRowSize[exportOptions.value.format];
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
});

const canExport = computed(() => {
  return props.data.length > 0 && !isExporting.value;
});

// Methods
function selectTemplate(template: ReportTemplate) {
  selectedTemplate.value = template.id;
  exportOptions.value = {
    ...DEFAULT_EXPORT_OPTIONS,
    format: template.format,
    dataType: template.dataType,
    ...template.defaultOptions,
  };
}

async function handleExport() {
  if (!canExport.value) return;

  isExporting.value = true;
  exportProgress.value = 0;

  try {
    // 模擬進度
    const progressInterval = setInterval(() => {
      exportProgress.value = Math.min(exportProgress.value + 10, 90);
    }, 100);

    const result = await exportService.exportData(
      props.data,
      exportOptions.value,
    );

    clearInterval(progressInterval);
    exportProgress.value = 100;

    if (result.success) {
      emit("exported", result.filename);
      setTimeout(() => {
        emit("close");
      }, 1000);
    } else {
      console.error("Export failed:", result.error);
      alert(`導出失敗：${result.error}`);
    }
  } catch (error) {
    console.error("Export error:", error);
    alert("導出時發生錯誤");
  } finally {
    isExporting.value = false;
    exportProgress.value = 0;
  }
}

function handleClose() {
  if (!isExporting.value) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="handleClose"
    >
      <div
        class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <!-- 標題 -->
        <div
          class="flex items-center justify-between p-6 border-b border-gray-200"
        >
          <div class="flex items-center gap-3">
            <DocumentArrowDownIcon class="w-6 h-6 text-blue-600" />
            <h2 class="text-xl font-semibold text-gray-900">導出監控報告</h2>
          </div>
          <button
            :disabled="isExporting"
            class="text-gray-400 hover:text-gray-600"
            @click="handleClose"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>

        <!-- 內容 -->
        <div class="p-6 space-y-6">
          <!-- 快速範本 -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 mb-3">快速範本</h3>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="template in REPORT_TEMPLATES"
                :key="template.id"
                :class="[
                  'p-4 text-left border-2 rounded-lg transition-colors',
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ]"
                @click="selectTemplate(template)"
              >
                <div class="flex items-start gap-3">
                  <component
                    :is="formatIcons[template.format]"
                    class="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900">{{ template.name }}</p>
                    <p class="text-xs text-gray-500 mt-1 line-clamp-2">
                      {{ template.description }}
                    </p>
                    <p class="text-xs text-blue-600 mt-2">
                      {{ formatLabels[template.format] }}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- 自定義選項 -->
          <div class="border-t border-gray-200 pt-6">
            <h3 class="text-sm font-medium text-gray-900 mb-4">自定義選項</h3>

            <!-- 格式選擇 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                導出格式
              </label>
              <div class="grid grid-cols-3 gap-3">
                <button
                  v-for="format in formatOptions"
                  :key="format"
                  :class="[
                    'p-3 border-2 rounded-lg transition-colors',
                    exportOptions.format === format
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300',
                  ]"
                  @click="exportOptions.format = format"
                >
                  <component
                    :is="formatIcons[format]"
                    class="w-6 h-6 mx-auto mb-2 text-gray-600"
                  />
                  <p class="text-sm font-medium text-center">
                    {{ formatLabels[format] }}
                  </p>
                </button>
              </div>
            </div>

            <!-- 數據類型 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                數據類型
              </label>
              <select
                v-model="exportOptions.dataType"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option
                  v-for="(label, value) in dataTypeLabels"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </option>
              </select>
            </div>

            <!-- 時間範圍 -->
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  開始日期
                </label>
                <input
                  v-model="exportOptions.startDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  結束日期
                </label>
                <input
                  v-model="exportOptions.endDate"
                  type="date"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <!-- 包含選項 -->
            <div class="space-y-2">
              <label class="flex items-center">
                <input
                  v-model="exportOptions.includeSummary"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">包含摘要統計</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="exportOptions.includeDetails"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-gray-700">包含詳細數據</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="exportOptions.includeCharts"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  :disabled="exportOptions.format !== 'pdf'"
                />
                <span class="ml-2 text-sm text-gray-700">
                  包含圖表
                  <span
                    v-if="exportOptions.format !== 'pdf'"
                    class="text-gray-400"
                  >
                    (僅 PDF)
                  </span>
                </span>
              </label>
            </div>

            <!-- PDF 特定選項 -->
            <div
              v-if="exportOptions.format === 'pdf' && exportOptions.pdfOptions"
              class="mt-4 p-4 bg-gray-50 rounded-lg"
            >
              <h4 class="text-sm font-medium text-gray-900 mb-3">PDF 選項</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 mb-1">方向</label>
                  <select
                    v-model="exportOptions.pdfOptions.orientation"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="portrait">直向</option>
                    <option value="landscape">橫向</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-gray-700 mb-1"
                    >頁面大小</label
                  >
                  <select
                    v-model="exportOptions.pdfOptions.pageSize"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
              </div>
              <div class="mt-3 space-y-2">
                <label class="flex items-center">
                  <input
                    v-model="exportOptions.pdfOptions.includePageNumbers"
                    type="checkbox"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span class="ml-2 text-sm text-gray-700">包含頁碼</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 預覽信息 -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="text-sm font-medium text-blue-900 mb-2">導出預覽</h4>
            <div class="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p class="text-blue-700">記錄數</p>
                <p class="font-medium text-blue-900">{{ data.length }}</p>
              </div>
              <div>
                <p class="text-blue-700">估計大小</p>
                <p class="font-medium text-blue-900">{{ estimatedSize }}</p>
              </div>
              <div>
                <p class="text-blue-700">格式</p>
                <p class="font-medium text-blue-900 uppercase">
                  {{ exportOptions.format }}
                </p>
              </div>
            </div>
          </div>

          <!-- 進度條 -->
          <div v-if="isExporting" class="space-y-2">
            <div
              class="flex items-center justify-between text-sm text-gray-700"
            >
              <span>正在導出...</span>
              <span>{{ exportProgress }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${exportProgress}%` }"
              />
            </div>
          </div>
        </div>

        <!-- 操作按鈕 -->
        <div
          class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50"
        >
          <button
            :disabled="isExporting"
            class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            @click="handleClose"
          >
            取消
          </button>
          <button
            :disabled="!canExport"
            :class="[
              'flex items-center gap-2 px-6 py-2 text-sm text-white rounded-lg',
              canExport
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed',
            ]"
            @click="handleExport"
          >
            <DocumentArrowDownIcon class="w-4 h-4" />
            {{ isExporting ? "導出中..." : "導出報告" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
