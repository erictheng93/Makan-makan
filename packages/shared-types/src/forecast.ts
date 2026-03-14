// Forecast system shared types (API contract between backend and frontend)

export interface ForecastItemResult {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  confidence: number; // 0.0 to 1.0
  trend: "up" | "down" | "stable";
  trendPercent: number;
  historicalAvg: number;
}

export interface ForecastMetadata {
  dataSourceDays: number;
  model: string;
  weights: Record<string, number>;
  generatedAt: string;
}

export interface ForecastResult {
  date: string; // YYYY-MM-DD
  type: "item_level" | "ingredient_level";
  items: ForecastItemResult[];
  generatedBy: "statistical" | "ai_enhanced";
  metadata: ForecastMetadata;
  stale?: boolean;
}

export interface ForecastAccuracyItem {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  actual: number;
  deviation: number; // percentage
}

export interface ForecastAlert {
  type:
    | "high_demand"
    | "low_stock"
    | "unusual_spike"
    | "procurement_needed"
    | "excess_stock";
  menuItemId: number;
  menuItemName: string;
  message: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
  ingredientId?: number;
  ingredientName?: string;
}

export interface GenerateForecastRequest {
  startDate: string;
  endDate: string;
  type?: "item_level" | "ingredient_level";
  useAI?: boolean;
}
