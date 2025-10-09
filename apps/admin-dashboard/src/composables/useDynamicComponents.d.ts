/**
 * Dynamic Component Loading Composable
 *
 * Utilities for lazy loading heavy components and code splitting
 * to reduce initial bundle size and improve performance
 */
import { type Component } from 'vue';
export interface AsyncComponentOptions {
    loadingComponent?: Component;
    errorComponent?: Component;
    delay?: number;
    timeout?: number;
    suspensible?: boolean;
    onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => void;
}
/**
 * Create an async component with loading and error states
 *
 * @example
 * const HeavyChart = useLazyComponent(() => import('@/components/charts/HeavyChart.vue'), {
 *   delay: 200,
 *   timeout: 10000
 * })
 */
export declare function useLazyComponent(loader: () => Promise<Component>, options?: AsyncComponentOptions): import("vue").ComponentOptions<any, any, any, import("vue").ComputedOptions, import("vue").MethodOptions, any, any, any, string, {}, {}, string, {}, {}, {}, string, import("vue").ComponentProvideOptions> | import("vue").FunctionalComponent<any, {}, any, {}> | {
    new (...args: any[]): any;
    __isFragment?: never;
    __isTeleport?: never;
    __isSuspense?: never;
};
/**
 * Preload a component in the background
 * Useful for prefetching heavy components before they're needed
 *
 * @example
 * // Preload analytics components when dashboard is mounted
 * onMounted(() => {
 *   preloadComponent(() => import('@/views/AnalyticsView.vue'))
 * })
 */
export declare function preloadComponent(loader: () => Promise<Component>): Promise<Component>;
/**
 * Preload multiple components in parallel
 *
 * @example
 * preloadComponents([
 *   () => import('@/components/charts/LineChart.vue'),
 *   () => import('@/components/charts/BarChart.vue')
 * ])
 */
export declare function preloadComponents(loaders: Array<() => Promise<Component>>): Promise<Component[]>;
/**
 * Conditionally load component based on feature flag or user permission
 *
 * @example
 * const AdvancedAnalytics = useConditionalComponent(
 *   () => hasPermission('advanced_analytics'),
 *   () => import('@/components/AdvancedAnalytics.vue'),
 *   () => import('@/components/BasicAnalytics.vue')
 * )
 */
export declare function useConditionalComponent(condition: () => boolean, trueLoader: () => Promise<Component>, falseLoader: () => Promise<Component>, options?: AsyncComponentOptions): import("vue").ComponentOptions<any, any, any, import("vue").ComputedOptions, import("vue").MethodOptions, any, any, any, string, {}, {}, string, {}, {}, {}, string, import("vue").ComponentProvideOptions> | import("vue").FunctionalComponent<any, {}, any, {}> | {
    new (...args: any[]): any;
    __isFragment?: never;
    __isTeleport?: never;
    __isSuspense?: never;
};
/**
 * Load component only when element is visible (Intersection Observer)
 *
 * @example
 * const HeavyTable = useVisibilityComponent(
 *   elementRef,
 *   () => import('@/components/HeavyTable.vue')
 * )
 */
export declare function useVisibilityComponent(targetRef: {
    value: Element | null;
}, loader: () => Promise<Component>, options?: AsyncComponentOptions & {
    rootMargin?: string;
    threshold?: number;
}): import("vue").ComponentOptions<any, any, any, import("vue").ComputedOptions, import("vue").MethodOptions, any, any, any, string, {}, {}, string, {}, {}, {}, string, import("vue").ComponentProvideOptions> | import("vue").FunctionalComponent<any, {}, any, {}> | {
    new (...args: any[]): any;
    __isFragment?: never;
    __isTeleport?: never;
    __isSuspense?: never;
};
/**
 * Batch component loader for related components
 * Groups component imports to optimize network requests
 *
 * @example
 * const chartComponents = useBatchLoader({
 *   LineChart: () => import('@/components/charts/LineChart.vue'),
 *   BarChart: () => import('@/components/charts/BarChart.vue'),
 *   PieChart: () => import('@/components/charts/PieChart.vue')
 * })
 */
export declare function useBatchLoader<T extends Record<string, () => Promise<Component>>>(loaders: T): Record<keyof T, ReturnType<typeof useLazyComponent>>;
/**
 * Performance metrics for component loading
 */
export interface ComponentLoadMetrics {
    componentName: string;
    loadTime: number;
    success: boolean;
    error?: Error;
    timestamp: number;
}
/**
 * Track component loading performance
 */
export declare function useComponentMetrics(componentName: string): {
    recordSuccess: () => void;
    recordError: (error: Error) => void;
    getMetrics: () => ComponentLoadMetrics[];
};
/**
 * Create a component with automatic metrics tracking
 */
export declare function useLazyComponentWithMetrics(componentName: string, loader: () => Promise<Component>, options?: AsyncComponentOptions): import("vue").ComponentOptions<any, any, any, import("vue").ComputedOptions, import("vue").MethodOptions, any, any, any, string, {}, {}, string, {}, {}, {}, string, import("vue").ComponentProvideOptions> | import("vue").FunctionalComponent<any, {}, any, {}> | {
    new (...args: any[]): any;
    __isFragment?: never;
    __isTeleport?: never;
    __isSuspense?: never;
};
