export interface ForecastItemResult {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
  historicalAvg: number;
}

export interface ForecastResult {
  date: string;
  type: "item_level" | "ingredient_level";
  items: ForecastItemResult[];
  generatedBy: "statistical" | "ai_enhanced";
  metadata: ForecastMetadata;
  stale?: boolean;
}

export interface ForecastMetadata {
  dataSourceDays: number;
  model: string;
  weights: Record<string, number>;
  generatedAt: string;
}

export interface ForecastAccuracyItem {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  actual: number;
  deviation: number;
}

export interface ForecastAlert {
  type: "high_demand" | "low_stock" | "unusual_spike";
  menuItemId: number;
  menuItemName: string;
  message: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}
