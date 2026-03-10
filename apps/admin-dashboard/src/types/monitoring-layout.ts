/**
 * Monitoring Dashboard - Custom Layout Types
 * 監控儀表板 - 自定義佈局類型定義
 */

export type WidgetType =
  | "health-overview"
  | "key-metrics"
  | "component-status"
  | "active-alerts"
  | "performance-chart"
  | "error-log"
  | "realtime-connections"
  | "response-time-chart"
  | "throughput-chart"
  | "cache-metrics"
  | "database-metrics"
  | "custom-chart";

export type WidgetSize = "small" | "medium" | "large" | "xlarge";

export interface WidgetDimensions {
  width: number; // grid columns (1-12)
  height: number; // grid rows (1-6)
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface WidgetPosition {
  x: number; // grid column position (0-11)
  y: number; // grid row position (0-infinity)
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  dimensions: WidgetDimensions;
  config?: Record<string, any>; // Widget-specific configuration
  visible: boolean;
  locked: boolean; // Prevent moving/resizing
}

export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  gridColumns: number; // Default: 12
  gridRowHeight: number; // pixels
  isDefault: boolean;
  isSystem: boolean; // System layouts cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  thumbnail?: string;
  layout: Omit<DashboardLayout, "id" | "createdAt" | "updatedAt">;
}

// Widget 配置選項
export interface WidgetConfig {
  // 通用選項
  refreshInterval?: number; // seconds
  autoRefresh?: boolean;
  showTitle?: boolean;
  showBorder?: boolean;

  // 圖表選項
  chartType?: "line" | "bar" | "area" | "pie" | "doughnut";
  chartColors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;

  // 數據選項
  dataSource?: string;
  metrics?: string[];
  timeRange?: string;
  filters?: any;

  // 顯示選項
  displayMode?: "compact" | "detailed" | "minimal";
  theme?: "light" | "dark" | "auto";
}

// Widget 尺寸預設
export const WIDGET_SIZE_PRESETS: Record<WidgetSize, WidgetDimensions> = {
  small: { width: 3, height: 2, minWidth: 2, minHeight: 2 },
  medium: { width: 4, height: 3, minWidth: 3, minHeight: 2 },
  large: { width: 6, height: 4, minWidth: 4, minHeight: 3 },
  xlarge: { width: 12, height: 5, minWidth: 6, minHeight: 4 },
};

// Widget 類型元數據
export interface WidgetTypeMetadata {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  category: "overview" | "performance" | "alerts" | "metrics" | "charts";
  defaultSize: WidgetSize;
  defaultConfig: WidgetConfig;
  configurable: boolean;
}

export const WIDGET_TYPES: WidgetTypeMetadata[] = [
  {
    type: "health-overview",
    name: "健康狀態總覽",
    description: "系統整體健康狀態和分數",
    icon: "HeartIcon",
    category: "overview",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      showTitle: true,
      displayMode: "detailed",
    },
    configurable: true,
  },
  {
    type: "key-metrics",
    name: "關鍵指標",
    description: "重要性能指標的即時數據",
    icon: "ChartBarIcon",
    category: "metrics",
    defaultSize: "large",
    defaultConfig: {
      refreshInterval: 15,
      autoRefresh: true,
      showTitle: true,
      displayMode: "compact",
    },
    configurable: true,
  },
  {
    type: "component-status",
    name: "組件狀態",
    description: "各系統組件的運行狀態",
    icon: "CubeIcon",
    category: "overview",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      showTitle: true,
    },
    configurable: false,
  },
  {
    type: "active-alerts",
    name: "活動警報",
    description: "當前活躍的系統警報",
    icon: "BellIcon",
    category: "alerts",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 10,
      autoRefresh: true,
      showTitle: true,
      displayMode: "detailed",
    },
    configurable: true,
  },
  {
    type: "performance-chart",
    name: "性能圖表",
    description: "系統性能趨勢圖表",
    icon: "ChartLineIcon",
    category: "charts",
    defaultSize: "large",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      chartType: "line",
      showLegend: true,
      showGrid: true,
      timeRange: "last1hour",
    },
    configurable: true,
  },
  {
    type: "error-log",
    name: "錯誤日誌",
    description: "最近的錯誤記錄",
    icon: "ExclamationCircleIcon",
    category: "alerts",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      showTitle: true,
      displayMode: "compact",
    },
    configurable: true,
  },
  {
    type: "realtime-connections",
    name: "即時連接",
    description: "WebSocket 連接統計",
    icon: "SignalIcon",
    category: "metrics",
    defaultSize: "small",
    defaultConfig: {
      refreshInterval: 5,
      autoRefresh: true,
      showTitle: true,
    },
    configurable: false,
  },
  {
    type: "response-time-chart",
    name: "響應時間圖表",
    description: "API 響應時間趨勢",
    icon: "ClockIcon",
    category: "charts",
    defaultSize: "large",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      chartType: "area",
      showLegend: true,
      showGrid: true,
      timeRange: "last1hour",
    },
    configurable: true,
  },
  {
    type: "throughput-chart",
    name: "吞吐量圖表",
    description: "系統吞吐量趨勢",
    icon: "ArrowTrendingUpIcon",
    category: "charts",
    defaultSize: "large",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      chartType: "bar",
      showLegend: false,
      showGrid: true,
      timeRange: "last1hour",
    },
    configurable: true,
  },
  {
    type: "cache-metrics",
    name: "緩存指標",
    description: "緩存性能和命中率",
    icon: "ServerStackIcon",
    category: "metrics",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      showTitle: true,
      displayMode: "detailed",
    },
    configurable: false,
  },
  {
    type: "database-metrics",
    name: "數據庫指標",
    description: "數據庫性能統計",
    icon: "CircleStackIcon",
    category: "metrics",
    defaultSize: "medium",
    defaultConfig: {
      refreshInterval: 30,
      autoRefresh: true,
      showTitle: true,
      displayMode: "detailed",
    },
    configurable: false,
  },
  {
    type: "custom-chart",
    name: "自定義圖表",
    description: "可配置的自定義數據圖表",
    icon: "PresentationChartLineIcon",
    category: "charts",
    defaultSize: "large",
    defaultConfig: {
      refreshInterval: 60,
      autoRefresh: true,
      chartType: "line",
      showLegend: true,
      showGrid: true,
    },
    configurable: true,
  },
];

// 預設佈局範本
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "default-overview",
    name: "默認總覽",
    description: "平衡的總覽佈局，包含所有關鍵信息",
    icon: "ViewColumnsIcon",
    layout: {
      name: "默認總覽",
      gridColumns: 12,
      gridRowHeight: 80,
      isDefault: true,
      isSystem: true,
      widgets: [
        {
          id: "w1",
          type: "health-overview",
          title: "系統健康狀態",
          position: { x: 0, y: 0 },
          dimensions: { width: 4, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w2",
          type: "key-metrics",
          title: "關鍵指標",
          position: { x: 4, y: 0 },
          dimensions: { width: 8, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w3",
          type: "active-alerts",
          title: "活動警報",
          position: { x: 0, y: 3 },
          dimensions: { width: 6, height: 4 },
          visible: true,
          locked: false,
        },
        {
          id: "w4",
          type: "performance-chart",
          title: "性能趨勢",
          position: { x: 6, y: 3 },
          dimensions: { width: 6, height: 4 },
          visible: true,
          locked: false,
        },
      ],
    },
  },
  {
    id: "performance-focused",
    name: "性能專注",
    description: "專注於性能指標和圖表的佈局",
    icon: "ChartBarIcon",
    layout: {
      name: "性能專注",
      gridColumns: 12,
      gridRowHeight: 80,
      isDefault: false,
      isSystem: true,
      widgets: [
        {
          id: "w1",
          type: "key-metrics",
          title: "關鍵指標",
          position: { x: 0, y: 0 },
          dimensions: { width: 12, height: 2 },
          visible: true,
          locked: false,
        },
        {
          id: "w2",
          type: "response-time-chart",
          title: "響應時間",
          position: { x: 0, y: 2 },
          dimensions: { width: 6, height: 4 },
          visible: true,
          locked: false,
        },
        {
          id: "w3",
          type: "throughput-chart",
          title: "吞吐量",
          position: { x: 6, y: 2 },
          dimensions: { width: 6, height: 4 },
          visible: true,
          locked: false,
        },
        {
          id: "w4",
          type: "database-metrics",
          title: "數據庫指標",
          position: { x: 0, y: 6 },
          dimensions: { width: 6, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w5",
          type: "cache-metrics",
          title: "緩存指標",
          position: { x: 6, y: 6 },
          dimensions: { width: 6, height: 3 },
          visible: true,
          locked: false,
        },
      ],
    },
  },
  {
    id: "alerts-monitoring",
    name: "警報監控",
    description: "專注於警報和錯誤監控的佈局",
    icon: "BellAlertIcon",
    layout: {
      name: "警報監控",
      gridColumns: 12,
      gridRowHeight: 80,
      isDefault: false,
      isSystem: true,
      widgets: [
        {
          id: "w1",
          type: "health-overview",
          title: "系統健康",
          position: { x: 0, y: 0 },
          dimensions: { width: 3, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w2",
          type: "active-alerts",
          title: "活動警報",
          position: { x: 3, y: 0 },
          dimensions: { width: 9, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w3",
          type: "error-log",
          title: "錯誤日誌",
          position: { x: 0, y: 3 },
          dimensions: { width: 12, height: 4 },
          visible: true,
          locked: false,
        },
        {
          id: "w4",
          type: "component-status",
          title: "組件狀態",
          position: { x: 0, y: 7 },
          dimensions: { width: 12, height: 2 },
          visible: true,
          locked: false,
        },
      ],
    },
  },
  {
    id: "minimal",
    name: "極簡佈局",
    description: "簡潔的佈局，只顯示最關鍵的信息",
    icon: "Squares2X2Icon",
    layout: {
      name: "極簡佈局",
      gridColumns: 12,
      gridRowHeight: 100,
      isDefault: false,
      isSystem: true,
      widgets: [
        {
          id: "w1",
          type: "health-overview",
          title: "系統狀態",
          position: { x: 0, y: 0 },
          dimensions: { width: 6, height: 3 },
          visible: true,
          locked: false,
        },
        {
          id: "w2",
          type: "key-metrics",
          title: "關鍵指標",
          position: { x: 6, y: 0 },
          dimensions: { width: 6, height: 3 },
          visible: true,
          locked: false,
        },
      ],
    },
  },
];

// 默認佈局
export const DEFAULT_LAYOUT: DashboardLayout = {
  ...LAYOUT_PRESETS[0].layout,
  id: "default",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 生成唯一 Widget ID
export function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 檢查 Widget 位置是否重疊
export function checkWidgetOverlap(widget1: Widget, widget2: Widget): boolean {
  const w1 = {
    x1: widget1.position.x,
    y1: widget1.position.y,
    x2: widget1.position.x + widget1.dimensions.width,
    y2: widget1.position.y + widget1.dimensions.height,
  };
  const w2 = {
    x1: widget2.position.x,
    y1: widget2.position.y,
    x2: widget2.position.x + widget2.dimensions.width,
    y2: widget2.position.y + widget2.dimensions.height,
  };

  return !(
    w1.x2 <= w2.x1 ||
    w1.x1 >= w2.x2 ||
    w1.y2 <= w2.y1 ||
    w1.y1 >= w2.y2
  );
}

// 找到下一個可用位置
export function findNextAvailablePosition(
  existingWidgets: Widget[],
  dimensions: WidgetDimensions,
  gridColumns: number,
): WidgetPosition {
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x <= gridColumns - dimensions.width; x++) {
      const testWidget: Widget = {
        id: "test",
        type: "health-overview",
        title: "Test",
        position: { x, y },
        dimensions,
        visible: true,
        locked: false,
      };

      const hasOverlap = existingWidgets.some((w) =>
        checkWidgetOverlap(testWidget, w),
      );

      if (!hasOverlap) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
}
