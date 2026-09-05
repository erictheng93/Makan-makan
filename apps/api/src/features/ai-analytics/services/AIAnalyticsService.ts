/**
 * AI Analytics Service
 * Handles AI configuration, analytics generation, and product analysis
 */

import {
  AIInsightsService,
  ProductAnalysisService,
  testProvider as testAIProvider,
  getDefaultModel,
  getAvailableModels,
} from "@makanmasak/ai-analytics";
import { eq, sql, and } from "drizzle-orm";
import {
  aiConfigurations,
  aiUsageLogs,
  createDatabase,
} from "@makanmasak/database";
import { encrypt, decrypt } from "@makanmasak/utils";
import type { EncryptionOptions } from "@makanmasak/utils";
import { badRequest } from "../../../shared/utils/api-error";
import {
  AI_API_KEY_ENCRYPTION_SALT,
  type EncryptionSettings,
} from "../../../shared/utils/encryption";
import type { LLMConfig } from "@makanmasak/ai-analytics";
import type {
  AIConfiguration,
  AIConfigInput,
  TestProviderInput,
  TimeRange,
  AIUsageStats,
} from "../types";
import type {
  ProductAnalysis as PackageProductAnalysis,
  AIAnalyticsReport,
} from "@makanmasak/ai-analytics";

export class AIAnalyticsService {
  private db;
  private d1: D1Database;
  private encryptionKey: string;
  private cipher: EncryptionOptions;

  constructor(d1: D1Database, encryption: EncryptionSettings) {
    this.d1 = d1;
    this.db = createDatabase(d1);
    this.encryptionKey = encryption.key;
    this.cipher = {
      salt: AI_API_KEY_ENCRYPTION_SALT,
      requireStrongKey: encryption.requireStrongKey,
    };
  }

  async getConfig(restaurantId: string): Promise<AIConfiguration | null> {
    const [result] = await this.db
      .select()
      .from(aiConfigurations)
      .where(eq(aiConfigurations.restaurantId, restaurantId))
      .limit(1);

    if (!result) return null;

    return {
      id: result.id,
      restaurantId: result.restaurantId,
      provider: result.provider as AIConfiguration["provider"],
      apiKeyEncrypted: result.apiKeyEncrypted,
      model: result.model,
      customBaseUrl: result.customBaseUrl,
      enabled: result.enabled,
      createdAt: result.createdAt ?? "",
      updatedAt: result.updatedAt ?? "",
    };
  }

  async getLLMConfig(restaurantId: string): Promise<LLMConfig | null> {
    const [result] = await this.db
      .select({
        provider: aiConfigurations.provider,
        apiKeyEncrypted: aiConfigurations.apiKeyEncrypted,
        model: aiConfigurations.model,
        customBaseUrl: aiConfigurations.customBaseUrl,
      })
      .from(aiConfigurations)
      .where(
        and(
          eq(aiConfigurations.restaurantId, restaurantId),
          eq(aiConfigurations.enabled, true),
        ),
      )
      .limit(1);

    if (!result) return null;

    const apiKey = await decrypt(
      result.apiKeyEncrypted,
      this.encryptionKey,
      this.cipher,
    );

    return {
      provider: result.provider as LLMConfig["provider"],
      apiKey,
      model: result.model || undefined,
      baseUrl: result.customBaseUrl || undefined,
    };
  }

  async saveConfig(input: AIConfigInput): Promise<void> {
    // Encrypt API key
    const encryptedKey = await encrypt(
      input.apiKey,
      this.encryptionKey,
      this.cipher,
    );

    // Test the provider first
    const testResult = await this.testProvider({
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      baseUrl: input.customBaseUrl,
    });

    if (!testResult.success) {
      throw new Error(`Provider test failed: ${testResult.error}`);
    }

    // Save configuration (upsert on restaurant_id)
    const now = new Date().toISOString();
    await this.db
      .insert(aiConfigurations)
      .values({
        restaurantId: input.restaurantId,
        provider: input.provider,
        apiKeyEncrypted: encryptedKey,
        model: input.model || null,
        customBaseUrl: input.customBaseUrl || null,
        enabled: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: aiConfigurations.restaurantId,
        set: {
          provider: sql`excluded.provider`,
          apiKeyEncrypted: sql`excluded.api_key_encrypted`,
          model: sql`excluded.model`,
          customBaseUrl: sql`excluded.custom_base_url`,
          enabled: sql`1`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async testProvider(input: TestProviderInput): Promise<{
    success: boolean;
    latencyMs?: number;
    model?: string;
    error?: string;
  }> {
    try {
      const result = await testAIProvider({
        provider: input.provider,
        apiKey: input.apiKey,
        model: input.model,
        baseUrl: input.baseUrl,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      };
    }
  }

  async generateReport(
    restaurantId: string,
    timeRange: TimeRange,
    options?: { includeForecasting?: boolean; refreshCache?: boolean },
  ): Promise<AIAnalyticsReport> {
    const llmConfig = await this.getLLMConfig(restaurantId);

    if (!llmConfig) {
      throw badRequest(
        "AI provider not configured. Please configure an AI provider first.",
        "AI_PROVIDER_NOT_CONFIGURED",
      );
    }

    const service = new AIInsightsService(this.d1, this.db);
    const report = await service.generateReport(
      restaurantId,
      llmConfig,
      timeRange,
      {
        includeForecasting: options?.includeForecasting,
        refreshCache: options?.refreshCache,
      },
    );

    // Log usage
    await this.db.insert(aiUsageLogs).values({
      restaurantId,
      provider: llmConfig.provider,
      model: llmConfig.model || getDefaultModel(llmConfig.provider),
      operation: "generate_report",
      tokensUsed: report.metadata.tokensUsed || 0,
      latencyMs: report.metadata.processingTimeMs,
      success: true,
    });

    return report;
  }

  async getTrafficDrivers(
    restaurantId: string,
    timeRange: TimeRange,
    limit: number = 10,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.db);
    return service.getTrafficDrivers(restaurantId, timeRange, limit);
  }

  async getBestsellers(
    restaurantId: string,
    timeRange: TimeRange,
    limit: number = 10,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.db);
    return service.getBestsellers(restaurantId, timeRange, limit);
  }

  async getProfitLeaders(
    restaurantId: string,
    timeRange: TimeRange,
    limit: number = 10,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.db);
    return service.getProfitLeaders(restaurantId, timeRange, limit);
  }

  async analyzeProducts(
    restaurantId: string,
    timeRange: TimeRange,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.db);
    return service.analyzeProducts(restaurantId, timeRange);
  }

  async getUsageStats(
    restaurantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AIUsageStats[]> {
    const conditions = [eq(aiUsageLogs.restaurantId, restaurantId)];

    if (startDate) {
      conditions.push(sql`DATE(${aiUsageLogs.createdAt}) >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`DATE(${aiUsageLogs.createdAt}) <= ${endDate}`);
    }

    const result = await this.db
      .select({
        provider: aiUsageLogs.provider,
        model: aiUsageLogs.model,
        operation: aiUsageLogs.operation,
        requestCount: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`SUM(${aiUsageLogs.tokensUsed})`,
        avgLatencyMs: sql<number>`AVG(${aiUsageLogs.latencyMs})`,
        successfulRequests: sql<number>`SUM(CASE WHEN ${aiUsageLogs.success} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(aiUsageLogs)
      .where(and(...conditions))
      .groupBy(aiUsageLogs.provider, aiUsageLogs.model, aiUsageLogs.operation)
      .orderBy(sql`COUNT(*) DESC`);

    return result.map((row) => ({
      provider: row.provider as AIUsageStats["provider"],
      model: row.model,
      operation: row.operation,
      requestCount: row.requestCount,
      totalTokens: row.totalTokens,
      avgLatencyMs: row.avgLatencyMs,
      successfulRequests: row.successfulRequests,
    }));
  }

  // Static helper methods
  static getAvailableModels(provider: string) {
    return getAvailableModels(provider as LLMConfig["provider"]);
  }

  static getDefaultModel(provider: string) {
    return getDefaultModel(provider as LLMConfig["provider"]);
  }
}
