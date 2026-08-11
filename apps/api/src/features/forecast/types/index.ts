// Re-export shared types (API contract)
export type {
  ForecastItemResult,
  ForecastResult,
  ForecastMetadata,
  ForecastAccuracyItem,
  ForecastAlert,
  GenerateForecastRequest,
  IngredientForecastItem,
  IngredientForecastResult,
} from "@makanmasak/shared-types";

import type {
  ForecastResult,
  ForecastAccuracyItem,
  ForecastAlert,
  IngredientForecastResult,
} from "@makanmasak/shared-types";

// API-only types (service internals)

export interface GenerateForecastOptions {
  startDate: string;
  endDate: string;
  type?: "item_level" | "ingredient_level";
  useAI?: boolean;
}

export interface IForecastService {
  generateForecast(
    restaurantId: string,
    options: GenerateForecastOptions,
  ): Promise<ForecastResult[]>;
  getForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
    type?: string,
  ): Promise<ForecastResult[]>;
  getAccuracy(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<ForecastAccuracyItem[]>;
  getAlerts(restaurantId: string): Promise<ForecastAlert[]>;
}

export interface IIngredientForecastService {
  generateIngredientForecast(
    restaurantId: string,
    options: { startDate: string; endDate: string; useAI?: boolean },
  ): Promise<IngredientForecastResult[]>;
  getIngredientForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<IngredientForecastResult[]>;
}
