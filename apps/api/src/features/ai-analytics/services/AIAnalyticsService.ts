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
} from "@makanmakan/ai-analytics";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and } from "drizzle-orm";
import { aiConfigurations, aiUsageLogs } from "@makanmakan/database";
import type { LLMConfig } from "@makanmakan/ai-analytics";
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
} from "@makanmakan/ai-analytics";

/**
 * AES-256-GCM encryption for API keys using Web Crypto API
 * Format: base64(iv):base64(encrypted):base64(authTag)
 */

// Helper to convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// Helper to convert ArrayBuffer to string
function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive a 256-bit key from the encryption key string
async function deriveKey(keyString: string): Promise<CryptoKey> {
  // Use the key string as password and derive a proper AES key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(keyString),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  // Use a fixed salt (in production, consider storing salt per-encryption)
  const salt = stringToUint8Array("makanmakan-api-key-encryption-salt");

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptApiKey(
  apiKey: string,
  encryptionKey: string,
): Promise<string> {
  try {
    // Generate a random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive AES key from encryption key string
    const key = await deriveKey(encryptionKey);

    // Encrypt the API key
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128, // 128-bit auth tag
      },
      key,
      stringToUint8Array(apiKey),
    );

    // The encrypted result includes the ciphertext and auth tag
    // Format: base64(iv):base64(encryptedWithTag)
    const ivBase64 = arrayBufferToBase64(iv.buffer);
    const encryptedBase64 = arrayBufferToBase64(encrypted);

    return `${ivBase64}:${encryptedBase64}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt API key");
  }
}

async function decryptApiKey(
  encryptedKey: string,
  encryptionKey: string,
): Promise<string> {
  try {
    // Check if it's the old base64-only format (for backward compatibility)
    if (!encryptedKey.includes(":")) {
      // Legacy format - just base64 encoded
      console.warn(
        "Using legacy base64 decoding for API key - please re-save configuration to use encryption",
      );
      return atob(encryptedKey);
    }

    // Parse the encrypted format: base64(iv):base64(encryptedWithTag)
    const [ivBase64, encryptedBase64] = encryptedKey.split(":");

    if (!ivBase64 || !encryptedBase64) {
      throw new Error("Invalid encrypted key format");
    }

    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
    const encrypted = base64ToArrayBuffer(encryptedBase64);

    // Derive AES key from encryption key string
    const key = await deriveKey(encryptionKey);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
      },
      key,
      encrypted,
    );

    return arrayBufferToString(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt API key");
  }
}

export class AIAnalyticsService {
  private db;
  private d1: D1Database;
  private encryptionKey: string;

  constructor(d1: D1Database, encryptionKey: string) {
    this.d1 = d1;
    this.db = drizzle(d1);
    this.encryptionKey = encryptionKey;
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

    const apiKey = await decryptApiKey(
      result.apiKeyEncrypted,
      this.encryptionKey,
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
    const encryptedKey = await encryptApiKey(input.apiKey, this.encryptionKey);

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
      throw new Error(
        "AI provider not configured. Please configure an AI provider first.",
      );
    }

    // AIInsightsService expects raw D1Database
    const service = new AIInsightsService(this.d1);
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
    const service = new ProductAnalysisService(this.d1);
    return service.getTrafficDrivers(restaurantId, timeRange, limit);
  }

  async getBestsellers(
    restaurantId: string,
    timeRange: TimeRange,
    limit: number = 10,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.d1);
    return service.getBestsellers(restaurantId, timeRange, limit);
  }

  async getProfitLeaders(
    restaurantId: string,
    timeRange: TimeRange,
    limit: number = 10,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.d1);
    return service.getProfitLeaders(restaurantId, timeRange, limit);
  }

  async analyzeProducts(
    restaurantId: string,
    timeRange: TimeRange,
  ): Promise<PackageProductAnalysis[]> {
    const service = new ProductAnalysisService(this.d1);
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
