/**
 * Contract Tests for AI Analytics API
 *
 * Validates that AI analytics API responses match their declared Zod
 * schemas. These endpoints have unique response shapes (config, report,
 * products, usage, models) that differ from the standard envelope.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  GetConfigResponse,
  SaveConfigResponse,
  TestProviderResponse,
  GenerateReportResponse,
  ProductAnalysisResponse,
  UsageStatsResponse,
  ListModelsResponse,
} from "../../../contracts/schemas/ai-analytics";

describe("AI Analytics API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------
  describe("GetConfigResponse", () => {
    it("should match schema with config and available providers", () => {
      const mockResponse = {
        success: true as const,
        config: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          maxTokens: 2000,
        },
        availableProviders: ["openai", "anthropic", "google"],
      };

      assertMatchesSchema(
        GetConfigResponse,
        mockResponse,
        "GET /ai-analytics/config",
      );
    });

    it("should match schema without optional availableProviders", () => {
      const mockResponse = {
        success: true as const,
        config: {
          provider: "anthropic",
          model: "claude-3-opus",
        },
      };

      assertMatchesSchema(
        GetConfigResponse,
        mockResponse,
        "GET /ai-analytics/config (no providers)",
      );
    });

    it("should match schema with null config", () => {
      const mockResponse = {
        success: true as const,
        config: null,
        availableProviders: ["openai"],
      };

      assertMatchesSchema(
        GetConfigResponse,
        mockResponse,
        "GET /ai-analytics/config (null config)",
      );
    });
  });

  describe("SaveConfigResponse", () => {
    it("should match schema with message and test result", () => {
      const mockResponse = {
        success: true as const,
        message: "Configuration saved successfully",
        testResult: {
          latencyMs: 450,
          model: "gpt-4",
        },
      };

      assertMatchesSchema(
        SaveConfigResponse,
        mockResponse,
        "POST /ai-analytics/config",
      );
    });

    it("should match schema without optional testResult", () => {
      const mockResponse = {
        success: true as const,
        message: "Configuration saved successfully",
      };

      assertMatchesSchema(
        SaveConfigResponse,
        mockResponse,
        "POST /ai-analytics/config (no test)",
      );
    });

    it("should match schema with latency in testResult", () => {
      const mockResponse = {
        success: true as const,
        message: "Configuration saved",
        testResult: {
          latency: 0.45,
          latencyMs: 450,
          model: "claude-3-opus",
        },
      };

      assertMatchesSchema(
        SaveConfigResponse,
        mockResponse,
        "POST /ai-analytics/config (full test)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Test Provider
  // -------------------------------------------------------------------------
  describe("TestProviderResponse", () => {
    it("should match schema for successful provider test", () => {
      const mockResponse = {
        success: true,
        latencyMs: 320,
        model: "gpt-4-turbo",
      };

      assertMatchesSchema(
        TestProviderResponse,
        mockResponse,
        "POST /ai-analytics/test-provider",
      );
    });

    it("should match schema for failed provider test", () => {
      const mockResponse = {
        success: false,
        error: "API key invalid",
      };

      assertMatchesSchema(
        TestProviderResponse,
        mockResponse,
        "POST /ai-analytics/test-provider (error)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Generate Report
  // -------------------------------------------------------------------------
  describe("GenerateReportResponse", () => {
    it("should match schema with report data", () => {
      const mockResponse = {
        success: true as const,
        report: {
          summary: "Revenue is trending upward by 15% this month.",
          insights: [
            "Nasi Lemak remains the top seller",
            "Lunch hour traffic increased by 20%",
          ],
          recommendations: ["Consider adding a lunch combo deal"],
          generatedAt: new Date().toISOString(),
        },
        cached: false,
      };

      assertMatchesSchema(
        GenerateReportResponse,
        mockResponse,
        "POST /ai-analytics/report",
      );
    });

    it("should match schema with cached report", () => {
      const mockResponse = {
        success: true as const,
        report: {
          summary: "Cached report from earlier today.",
        },
        cached: true,
      };

      assertMatchesSchema(
        GenerateReportResponse,
        mockResponse,
        "POST /ai-analytics/report (cached)",
      );
    });

    it("should match schema without optional cached field", () => {
      const mockResponse = {
        success: true as const,
        report: {
          summary: "Basic report",
        },
      };

      assertMatchesSchema(
        GenerateReportResponse,
        mockResponse,
        "POST /ai-analytics/report (no cached)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Product Analysis
  // -------------------------------------------------------------------------
  describe("ProductAnalysisResponse", () => {
    it("should match schema with products array", () => {
      const mockResponse = {
        success: true as const,
        products: [
          {
            id: "item-001",
            name: "Nasi Lemak",
            revenue: 3200,
            trend: "up",
            recommendation: "Maintain current pricing",
          },
          {
            id: "item-002",
            name: "Roti Canai",
            revenue: 2850,
            trend: "stable",
            recommendation: "Consider bundling",
          },
        ],
      };

      assertMatchesSchema(
        ProductAnalysisResponse,
        mockResponse,
        "GET /ai-analytics/products",
      );
    });

    it("should match schema with empty products array", () => {
      const mockResponse = {
        success: true as const,
        products: [],
      };

      assertMatchesSchema(
        ProductAnalysisResponse,
        mockResponse,
        "GET /ai-analytics/products (empty)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Usage Stats
  // -------------------------------------------------------------------------
  describe("UsageStatsResponse", () => {
    it("should match schema with usage data", () => {
      const mockResponse = {
        success: true as const,
        usage: {
          totalRequests: 150,
          tokensUsed: 250000,
          costEstimate: 12.5,
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
          byProvider: {
            openai: { requests: 100, tokens: 200000 },
            anthropic: { requests: 50, tokens: 50000 },
          },
        },
      };

      assertMatchesSchema(
        UsageStatsResponse,
        mockResponse,
        "GET /ai-analytics/usage",
      );
    });

    it("should match schema with minimal usage data", () => {
      const mockResponse = {
        success: true as const,
        usage: {
          totalRequests: 0,
          tokensUsed: 0,
        },
      };

      assertMatchesSchema(
        UsageStatsResponse,
        mockResponse,
        "GET /ai-analytics/usage (minimal)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // List Models
  // -------------------------------------------------------------------------
  describe("ListModelsResponse", () => {
    it("should match schema with models list and default model", () => {
      const mockResponse = {
        success: true as const,
        provider: "openai",
        models: [
          { id: "gpt-4", name: "GPT-4", contextWindow: 128000 },
          { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000 },
          { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16000 },
        ],
        defaultModel: "gpt-4",
      };

      assertMatchesSchema(
        ListModelsResponse,
        mockResponse,
        "GET /ai-analytics/models",
      );
    });

    it("should match schema without optional defaultModel", () => {
      const mockResponse = {
        success: true as const,
        provider: "anthropic",
        models: [
          { id: "claude-3-opus", name: "Claude 3 Opus" },
          { id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
        ],
      };

      assertMatchesSchema(
        ListModelsResponse,
        mockResponse,
        "GET /ai-analytics/models (no default)",
      );
    });

    it("should match schema with empty models list", () => {
      const mockResponse = {
        success: true as const,
        provider: "custom",
        models: [],
      };

      assertMatchesSchema(
        ListModelsResponse,
        mockResponse,
        "GET /ai-analytics/models (empty)",
      );
    });
  });
});
