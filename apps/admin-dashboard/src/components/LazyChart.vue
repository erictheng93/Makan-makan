<template>
  <div ref="containerRef" :style="{ minHeight: minHeight }">
    <!-- 占位符 Skeleton -->
    <div
      v-if="!state.shouldLoad"
      class="animate-pulse bg-gray-100 rounded-lg"
      :style="{ height: minHeight }"
    >
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div
            class="inline-block w-12 h-12 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin mb-2"
          ></div>
          <p class="text-sm text-gray-500">{{ loadingText }}</p>
        </div>
      </div>
    </div>

    <!-- 實際組件 -->
    <div v-else>
      <!-- 加載狀態覆蓋層 -->
      <Transition name="fade">
        <div
          v-if="state.isLoading && showLoadingOverlay"
          class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"
        >
          <div class="text-center">
            <div
              class="inline-block w-8 h-8 border-4 border-gray-300 border-t-primary-600 rounded-full animate-spin mb-1"
            ></div>
            <p class="text-xs text-gray-500">{{ loadingText }}</p>
          </div>
        </div>
      </Transition>

      <!-- 插槽：實際的圖表組件 -->
      <slot :is-loaded="state.isLoaded" :load="load" />
    </div>

    <!-- 錯誤狀態 -->
    <div
      v-if="state.error"
      class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
      :style="{ minHeight: minHeight }"
    >
      <div class="text-red-600 mb-2">
        <svg
          class="w-12 h-12 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h4 class="text-sm font-semibold text-red-800 mb-1">
        {{ t("common.loadFailed") }}
      </h4>
      <p class="text-xs text-red-600 mb-3">{{ state.error.message }}</p>
      <button
        class="text-sm text-red-600 hover:text-red-700 font-medium"
        @click="reset"
      >
        {{ t("common.retry") }}
      </button>
    </div>

    <!-- 調試信息 -->
    <div
      v-if="debug && state.shouldLoad"
      class="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded"
    >
      <div>Intersecting: {{ state.isIntersecting }}</div>
      <div>Ratio: {{ state.intersectionRatio.toFixed(2) }}</div>
      <div>Loaded: {{ state.isLoaded }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  useLazyComponent,
  CHART_LAZY_CONFIG,
  type LazyComponentOptions,
} from "@/composables/useLazyComponent";
import { useI18n } from "@/i18n";

const { t } = useI18n();

// ============================================================================
// Props
// ============================================================================

interface Props {
  /**
   * 最小高度（用於占位符）
   * 默認：'300px'
   */
  minHeight?: string;

  /**
   * 載入文字
   * 默認：'載入中...'
   */
  loadingText?: string;

  /**
   * 是否顯示加載覆蓋層
   * 默認：false
   */
  showLoadingOverlay?: boolean;

  /**
   * 懶加載配置（覆蓋默認配置）
   */
  lazyConfig?: Partial<LazyComponentOptions>;

  /**
   * 是否啟用調試模式
   * 默認：false
   */
  debug?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  minHeight: "300px",
  loadingText: "載入中...",
  showLoadingOverlay: false,
  lazyConfig: () => ({}),
  debug: false,
});

// ============================================================================
// 懶加載邏輯
// ============================================================================

const containerRef = ref<HTMLElement | null>(null);

// 合併配置
const config: LazyComponentOptions = {
  ...CHART_LAZY_CONFIG,
  ...props.lazyConfig,
  debug: props.debug,
};

// 使用懶加載 composable
const { state, load, reset } = useLazyComponent(containerRef, config);

// ============================================================================
// 對外暴露 API
// ============================================================================

defineExpose({
  load,
  reset,
  state,
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
