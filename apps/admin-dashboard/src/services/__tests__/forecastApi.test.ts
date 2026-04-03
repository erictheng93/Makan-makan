/**
 * Forecast API Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
  },
}));

import { forecastApi } from "../forecastApi";

describe("forecastApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generate", () => {
    it("should POST to generate endpoint and return forecasts", async () => {
      const forecasts = [{ id: "f1", date: "2026-04-03" }];
      mockApiPost.mockResolvedValue({
        data: { data: { forecasts } },
      });

      const params = { startDate: "2026-04-01", endDate: "2026-04-07", type: "daily" };
      const result = await forecastApi.generate("r1", params as any);

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith("/forecast/r1/generate", params);
      expect(result).toEqual(forecasts);
    });
  });

  describe("getForecast", () => {
    it("should GET forecasts with query params", async () => {
      const forecasts = [{ id: "f1" }];
      mockApiGet.mockResolvedValue({
        data: { data: { forecasts } },
      });

      const params = { date: "2026-04-03" };
      const result = await forecastApi.getForecast("r1", params);

      expect(mockApiGet).toHaveBeenCalledWith("/forecast/r1", params);
      expect(result).toEqual(forecasts);
    });

    it("should support date range params", async () => {
      mockApiGet.mockResolvedValue({
        data: { data: { forecasts: [] } },
      });

      const params = { startDate: "2026-04-01", endDate: "2026-04-07" };
      await forecastApi.getForecast("r1", params);

      expect(mockApiGet).toHaveBeenCalledWith("/forecast/r1", params);
    });
  });

  describe("getAccuracy", () => {
    it("should GET accuracy data", async () => {
      const accuracy = [{ itemId: "i1", mape: 0.05 }];
      mockApiGet.mockResolvedValue({
        data: { data: { accuracy } },
      });

      const params = { startDate: "2026-03-01", endDate: "2026-03-31" };
      const result = await forecastApi.getAccuracy("r1", params);

      expect(mockApiGet).toHaveBeenCalledWith("/forecast/r1/accuracy", params);
      expect(result).toEqual(accuracy);
    });
  });

  describe("getAlerts", () => {
    it("should GET alerts for restaurant", async () => {
      const alerts = [{ id: "a1", type: "anomaly" }];
      mockApiGet.mockResolvedValue({
        data: { data: { alerts } },
      });

      const result = await forecastApi.getAlerts("r1");

      expect(mockApiGet).toHaveBeenCalledWith("/forecast/r1/alerts");
      expect(result).toEqual(alerts);
    });
  });

  describe("getIngredientForecast", () => {
    it("should GET ingredient forecasts", async () => {
      const forecasts = [{ ingredientId: "ing1", quantity: 50 }];
      mockApiGet.mockResolvedValue({
        data: { data: { forecasts } },
      });

      const params = { startDate: "2026-04-01", endDate: "2026-04-07" };
      const result = await forecastApi.getIngredientForecast("r1", params);

      expect(mockApiGet).toHaveBeenCalledWith(
        "/forecast/r1/ingredient-forecast",
        params,
      );
      expect(result).toEqual(forecasts);
    });
  });

  describe("generateIngredientForecast", () => {
    it("should POST with ingredient_level type", async () => {
      const forecasts = [{ ingredientId: "ing1" }];
      mockApiPost.mockResolvedValue({
        data: { data: { forecasts } },
      });

      const params = { startDate: "2026-04-01", endDate: "2026-04-07", useAI: true };
      const result = await forecastApi.generateIngredientForecast("r1", params);

      expect(mockApiPost).toHaveBeenCalledWith("/forecast/r1/generate", {
        ...params,
        type: "ingredient_level",
      });
      expect(result).toEqual(forecasts);
    });
  });
});
