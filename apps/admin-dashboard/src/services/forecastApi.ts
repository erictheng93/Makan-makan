import { api } from "./api";
import type {
  ForecastResult,
  ForecastAccuracyItem,
  ForecastAlert,
  GenerateForecastRequest,
} from "@makanmakan/shared-types";

export const forecastApi = {
  async generate(
    restaurantId: string,
    params: GenerateForecastRequest,
  ): Promise<ForecastResult[]> {
    const res = await api.post<{ forecasts: ForecastResult[] }>(
      `/forecast/${restaurantId}/generate`,
      params,
    );
    return res.data.data!.forecasts;
  },

  async getForecast(
    restaurantId: string,
    params: {
      date?: string;
      startDate?: string;
      endDate?: string;
      type?: string;
    },
  ): Promise<ForecastResult[]> {
    const res = await api.get<{ forecasts: ForecastResult[] }>(
      `/forecast/${restaurantId}`,
      params,
    );
    return res.data.data!.forecasts;
  },

  async getAccuracy(
    restaurantId: string,
    params: {
      startDate: string;
      endDate: string;
    },
  ): Promise<ForecastAccuracyItem[]> {
    const res = await api.get<{ accuracy: ForecastAccuracyItem[] }>(
      `/forecast/${restaurantId}/accuracy`,
      params,
    );
    return res.data.data!.accuracy;
  },

  async getAlerts(restaurantId: string): Promise<ForecastAlert[]> {
    const res = await api.get<{ alerts: ForecastAlert[] }>(
      `/forecast/${restaurantId}/alerts`,
    );
    return res.data.data!.alerts;
  },
};
