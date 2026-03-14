import api from "./api";
import type {
  ForecastResult,
  ForecastAccuracyItem,
  ForecastAlert,
} from "./types/forecast";

export interface ForecastResponse<T> {
  success: boolean;
  data: T;
}

export const forecastApi = {
  async generate(
    restaurantId: string,
    params: {
      startDate: string;
      endDate: string;
      type?: string;
      useAI?: boolean;
    },
  ): Promise<ForecastResult[]> {
    const res = await api.post(`/forecast/${restaurantId}/generate`, params);
    return res.data.data.forecasts;
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
    const res = await api.get(`/forecast/${restaurantId}`, { params });
    return res.data.data.forecasts;
  },

  async getAccuracy(
    restaurantId: string,
    params: {
      startDate: string;
      endDate: string;
    },
  ): Promise<ForecastAccuracyItem[]> {
    const res = await api.get(`/forecast/${restaurantId}/accuracy`, { params });
    return res.data.data.accuracy;
  },

  async getAlerts(restaurantId: string): Promise<ForecastAlert[]> {
    const res = await api.get(`/forecast/${restaurantId}/alerts`);
    return res.data.data.alerts;
  },
};
