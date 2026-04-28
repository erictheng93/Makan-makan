import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: mockApi,
}));

import { api } from "@/services/api";
import { useAIAnalytics } from "../useAIAnalytics";

describe("useAIAnalytics", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("gets AI config through the shared API client", async () => {
    const config = { success: true, config: { provider: "openai" } };
    vi.mocked(api.get).mockResolvedValue({ data: config } as any);

    const { getConfig, loading, error } = useAIAnalytics();
    const result = await getConfig("r1");

    expect(api.get).toHaveBeenCalledWith("/ai-analytics/config/r1", undefined);
    expect(result).toBe(config);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("saves AI config without stringifying payload in the composable", async () => {
    const resultData = { success: true, message: "Saved" };
    const payload = {
      restaurantId: "r1",
      provider: "openai",
      apiKey: "secret",
      model: "gpt-4o-mini",
      enabled: true,
    };
    vi.mocked(api.post).mockResolvedValue({ data: resultData } as any);

    const { saveConfig } = useAIAnalytics();
    const result = await saveConfig(payload as any);

    expect(api.post).toHaveBeenCalledWith("/ai-analytics/config", payload);
    expect(result).toBe(resultData);
  });

  it("generates reports through the shared API client", async () => {
    const report = { summary: "Revenue up" };
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, report },
    } as any);

    const { generateReport } = useAIAnalytics();
    const result = await generateReport("r1", { range: "30d" } as any, {
      refreshCache: true,
    });

    expect(api.post).toHaveBeenCalledWith("/ai-analytics/generate", {
      restaurantId: "r1",
      timeRange: { range: "30d" },
      refreshCache: true,
    });
    expect(result).toBe(report);
  });

  it("passes product query params as axios config", async () => {
    const products = [{ id: "p1", name: "Nasi Lemak" }];
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, products },
    } as any);

    const { getTrafficDrivers } = useAIAnalytics();
    const result = await getTrafficDrivers("r1", "7d", 5);

    expect(api.get).toHaveBeenCalledWith(
      "/ai-analytics/products/traffic-drivers/r1",
      {
        params: {
          timeRange: "7d",
          limit: 5,
        },
      },
    );
    expect(result).toBe(products);
  });

  it("omits undefined usage query params", async () => {
    const usage = [{ operation: "generate_report" }];
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, usage },
    } as any);

    const { getUsageStats } = useAIAnalytics();
    const result = await getUsageStats("r1", "2026-01-01");

    expect(api.get).toHaveBeenCalledWith("/ai-analytics/usage/r1", {
      params: {
        startDate: "2026-01-01",
      },
    });
    expect(result).toBe(usage);
  });

  it("falls back and exposes API error messages", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: {
        data: {
          error: { message: "Provider unavailable" },
        },
      },
    });

    const { getAvailableModels, error, loading } = useAIAnalytics();
    const result = await getAvailableModels("openai");

    expect(result).toEqual([]);
    expect(error.value).toBe("Provider unavailable");
    expect(loading.value).toBe(false);
  });
});
