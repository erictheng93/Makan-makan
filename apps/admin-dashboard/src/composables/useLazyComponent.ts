/**
 * Lazy Component Loading Composable
 * 基於 Intersection Observer 的組件懶加載
 *
 * 功能：
 * 1. 只在組件進入視口時加載和渲染
 * 2. 支持預加載（提前加載接近視口的組件）
 * 3. 提供加載狀態和錯誤處理
 * 4. 自動清理觀察器
 *
 * 性能目標：
 * - Dashboard TTI: 1.8s → 1.0s (-44%)
 * - 初始渲染組件數：8 → 2 (-75%)
 * - 按需加載其餘 6 個組件
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 懶加載配置
 */
export interface LazyComponentOptions {
  /**
   * 根元素（用於計算交叉）
   * 默認為視口
   */
  root?: Element | null

  /**
   * 根邊距（擴展或縮小根元素的邊界）
   * 例如：'100px' 表示提前 100px 開始加載
   * 默認：'200px' （提前加載）
   */
  rootMargin?: string

  /**
   * 交叉閾值（0.0 - 1.0）
   * 0.0 表示任何可見性都觸發
   * 0.5 表示 50% 可見時觸發
   * 默認：0.1 （10% 可見）
   */
  threshold?: number | number[]

  /**
   * 是否只觸發一次
   * true: 加載後停止觀察
   * false: 持續觀察（用於進入/離開動畫）
   * 默認：true
   */
  once?: boolean

  /**
   * 延遲加載時間（毫秒）
   * 用於避免快速滾動時的頻繁加載
   * 默認：0
   */
  delay?: number

  /**
   * 是否在伺服器端渲染時立即加載
   * 默認：true
   */
  loadOnSSR?: boolean

  /**
   * 是否啟用調試日誌
   * 默認：false
   */
  debug?: boolean
}

/**
 * 懶加載狀態
 */
export interface LazyComponentState {
  /** 是否在視口中 */
  isIntersecting: boolean
  /** 是否應該加載（考慮延遲後） */
  shouldLoad: boolean
  /** 是否已加載 */
  isLoaded: boolean
  /** 是否正在加載 */
  isLoading: boolean
  /** 加載錯誤 */
  error: Error | null
  /** 交叉比率（0.0 - 1.0） */
  intersectionRatio: number
}

// ============================================================================
// Composable 主體
// ============================================================================

/**
 * 使用懶加載組件
 *
 * @example
 * ```vue
 * <script setup>
 * const chartRef = ref(null)
 * const { shouldLoad, isLoading, isLoaded } = useLazyComponent(chartRef, {
 *   rootMargin: '200px', // 提前 200px 開始加載
 *   threshold: 0.1,
 * })
 * </script>
 *
 * <template>
 *   <div ref="chartRef">
 *     <div v-if="!shouldLoad" class="h-64 bg-gray-100"></div>
 *     <ChartComponent v-else-if="shouldLoad" />
 *     <div v-if="isLoading">Loading...</div>
 *   </div>
 * </template>
 * ```
 */
export function useLazyComponent(
  target: Ref<Element | null>,
  options: LazyComponentOptions = {}
) {
  // ========================================
  // 配置初始化
  // ========================================

  const {
    root = null,
    rootMargin = '200px', // 提前 200px 加載
    threshold = 0.1, // 10% 可見時觸發
    once = true,
    delay = 0,
    loadOnSSR = true,
    debug = false,
  } = options

  // ========================================
  // 響應式狀態
  // ========================================

  const state = ref<LazyComponentState>({
    isIntersecting: false,
    shouldLoad: false,
    isLoaded: false,
    isLoading: false,
    error: null,
    intersectionRatio: 0,
  })

  // ========================================
  // Intersection Observer
  // ========================================

  let observer: IntersectionObserver | null = null
  let loadTimer: number | null = null

  /**
   * 處理交叉事件
   */
  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (debug) {
        console.log('[LazyComponent] Intersection:', {
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio,
          target: entry.target,
        })
      }

      // 更新交叉狀態
      state.value.isIntersecting = entry.isIntersecting
      state.value.intersectionRatio = entry.intersectionRatio

      if (entry.isIntersecting) {
        // 進入視口
        if (delay > 0) {
          // 延遲加載
          if (loadTimer) clearTimeout(loadTimer)
          loadTimer = window.setTimeout(() => {
            triggerLoad()
          }, delay)
        } else {
          // 立即加載
          triggerLoad()
        }
      } else {
        // 離開視口
        if (loadTimer) {
          clearTimeout(loadTimer)
          loadTimer = null
        }
      }
    })
  }

  /**
   * 觸發加載
   */
  const triggerLoad = () => {
    if (state.value.shouldLoad) return // 已經標記為應該加載

    if (debug) {
      console.log('[LazyComponent] Triggering load')
    }

    state.value.shouldLoad = true
    state.value.isLoading = true

    // 如果只觸發一次，停止觀察
    if (once && observer && target.value) {
      observer.unobserve(target.value)
    }

    // 標記為已加載（異步組件加載完成後會自動更新）
    // 使用 requestIdleCallback 避免阻塞主線程
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        state.value.isLoaded = true
        state.value.isLoading = false
      })
    } else {
      setTimeout(() => {
        state.value.isLoaded = true
        state.value.isLoading = false
      }, 0)
    }
  }

  /**
   * 初始化 Intersection Observer
   */
  const initObserver = () => {
    // 檢查瀏覽器支持
    if (typeof IntersectionObserver === 'undefined') {
      if (debug) {
        console.warn('[LazyComponent] IntersectionObserver not supported, loading immediately')
      }
      triggerLoad()
      return
    }

    // 創建觀察器
    observer = new IntersectionObserver(handleIntersection, {
      root,
      rootMargin,
      threshold,
    })

    // 開始觀察
    if (target.value) {
      observer.observe(target.value)

      if (debug) {
        console.log('[LazyComponent] Observer initialized:', {
          rootMargin,
          threshold,
          target: target.value,
        })
      }
    }
  }

  /**
   * 清理觀察器
   */
  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }

    if (loadTimer) {
      clearTimeout(loadTimer)
      loadTimer = null
    }

    if (debug) {
      console.log('[LazyComponent] Cleanup')
    }
  }

  // ========================================
  // 手動控制 API
  // ========================================

  /**
   * 手動觸發加載（忽略可見性）
   */
  const load = () => {
    triggerLoad()
  }

  /**
   * 重置加載狀態
   */
  const reset = () => {
    state.value = {
      isIntersecting: false,
      shouldLoad: false,
      isLoaded: false,
      isLoading: false,
      error: null,
      intersectionRatio: 0,
    }

    // 重新初始化觀察器
    cleanup()
    if (target.value) {
      initObserver()
    }
  }

  // ========================================
  // 生命週期
  // ========================================

  onMounted(() => {
    // SSR 檢測
    if (typeof window === 'undefined') {
      if (loadOnSSR) {
        triggerLoad()
      }
      return
    }

    // 延遲初始化觀察器，避免阻塞初始渲染
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        initObserver()
      })
    } else {
      setTimeout(() => {
        initObserver()
      }, 100)
    }
  })

  onUnmounted(() => {
    cleanup()
  })

  // ========================================
  // 返回 API
  // ========================================

  return {
    // 狀態（解構以便直接使用）
    ...state.value,
    state, // 完整狀態對象

    // 方法
    load,
    reset,
    cleanup,
  }
}

// ============================================================================
// 預設配置導出
// ============================================================================

/**
 * 圖表懶加載配置
 * 提前 200px 開始加載，避免用戶看到載入過程
 */
export const CHART_LAZY_CONFIG: LazyComponentOptions = {
  rootMargin: '200px',
  threshold: 0.1,
  once: true,
  delay: 0,
  debug: false,
}

/**
 * 圖片懶加載配置
 * 提前 50px 開始加載，10% 可見觸發
 */
export const IMAGE_LAZY_CONFIG: LazyComponentOptions = {
  rootMargin: '50px',
  threshold: 0.1,
  once: true,
  delay: 0,
  debug: false,
}

/**
 * 重型組件懶加載配置
 * 完全進入視口才加載，避免浪費資源
 */
export const HEAVY_COMPONENT_LAZY_CONFIG: LazyComponentOptions = {
  rootMargin: '0px',
  threshold: 0.5, // 50% 可見
  once: true,
  delay: 100, // 延遲 100ms 避免快速滾動時加載
  debug: false,
}

/**
 * 動畫組件配置
 * 持續觀察，用於進入/離開動畫
 */
export const ANIMATED_COMPONENT_CONFIG: LazyComponentOptions = {
  rootMargin: '100px',
  threshold: [0, 0.25, 0.5, 0.75, 1.0], // 多個閾值
  once: false, // 持續觀察
  delay: 0,
  debug: false,
}
