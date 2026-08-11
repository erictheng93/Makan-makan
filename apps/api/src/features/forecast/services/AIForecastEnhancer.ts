import { createProvider } from "@makanmasak/ai-analytics";
import type { LLMConfig } from "@makanmasak/ai-analytics";
import type { IngredientForecastItem } from "@makanmasak/shared-types";

// Reuse encryption utilities (same pattern as AIAnalyticsService)
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

async function deriveKey(keyString: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(keyString),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

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

async function decryptApiKey(
  encryptedKey: string,
  encryptionKey: string,
): Promise<string> {
  if (!encryptedKey.includes(":")) {
    return atob(encryptedKey);
  }

  const [ivBase64, encryptedBase64] = encryptedKey.split(":");
  if (!ivBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted key format");
  }

  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const key = await deriveKey(encryptionKey);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encrypted,
  );

  return arrayBufferToString(decrypted);
}

interface AIEnhancementResult {
  enhancedForecasts: IngredientForecastItem[];
  recommendations: string[];
  adjustmentReasons: Record<number, string>;
}

interface LLMAdjustment {
  ingredientId: number;
  adjustmentFactor: number;
  reason: string;
}

interface LLMResponse {
  adjustments: LLMAdjustment[];
  recommendations: string[];
}

export class AIForecastEnhancer {
  constructor(
    private db: D1Database,
    private encryptionKey: string,
  ) {}

  async enhancePredictions(
    restaurantId: string,
    statisticalForecasts: IngredientForecastItem[],
    dateRange: { startDate: string; endDate: string },
  ): Promise<AIEnhancementResult> {
    // 1. Load AI configuration for this restaurant
    const llmConfig = await this.getLLMConfig(restaurantId);
    if (!llmConfig) {
      // No AI config → return forecasts as-is
      return {
        enhancedForecasts: statisticalForecasts,
        recommendations: [],
        adjustmentReasons: {},
      };
    }

    try {
      // 2. Build prompt with context
      const holidayContext = this.getHolidayContext(dateRange.startDate);
      const prompt = this.buildPrompt(
        statisticalForecasts,
        dateRange,
        holidayContext,
      );

      // 3. Call LLM
      const provider = createProvider(llmConfig);
      const response = await provider.chat({
        prompt,
        systemPrompt: this.getSystemPrompt(),
        maxTokens: 2000,
        temperature: 0.3,
        responseFormat: "json",
      });

      // 4. Parse and apply adjustments
      const parsed = this.parseResponse(response.content);
      const enhancedForecasts = this.applyAdjustments(
        statisticalForecasts,
        parsed.adjustments,
      );

      const adjustmentReasons: Record<number, string> = {};
      for (const adj of parsed.adjustments) {
        adjustmentReasons[adj.ingredientId] = adj.reason;
      }

      return {
        enhancedForecasts,
        recommendations: parsed.recommendations,
        adjustmentReasons,
      };
    } catch (error) {
      console.error("[AIForecastEnhancer] AI enhancement failed:", error);
      // Graceful degradation: return original forecasts
      return {
        enhancedForecasts: statisticalForecasts,
        recommendations: [],
        adjustmentReasons: {},
      };
    }
  }

  private async getLLMConfig(restaurantId: string): Promise<LLMConfig | null> {
    const result = await this.db
      .prepare(
        "SELECT provider, api_key_encrypted, model, custom_base_url FROM ai_configurations WHERE restaurant_id = ? AND enabled = 1 LIMIT 1",
      )
      .bind(restaurantId)
      .first<{
        provider: string;
        api_key_encrypted: string;
        model: string | null;
        custom_base_url: string | null;
      }>();

    if (!result) return null;

    const apiKey = await decryptApiKey(
      result.api_key_encrypted,
      this.encryptionKey,
    );

    return {
      provider: result.provider as LLMConfig["provider"],
      apiKey,
      model: result.model || undefined,
      baseUrl: result.custom_base_url || undefined,
    };
  }

  private getSystemPrompt(): string {
    return `你是餐廳食材需求預測的 AI 助手。你的任務是根據統計預測結果和額外脈絡（例如節假日、天氣、季節），對食材需求量提出調整建議。

回應格式必須為 JSON：
{
  "adjustments": [
    { "ingredientId": 123, "adjustmentFactor": 1.2, "reason": "週末用量通常增加 20%" }
  ],
  "recommendations": [
    "建議提前備貨高需求食材",
    "注意時令食材的價格波動"
  ]
}

規則：
1. adjustmentFactor 必須在 0.5 到 2.0 之間
2. 只對有明確理由的食材提出調整
3. 不需調整的食材不要列入 adjustments
4. recommendations 最多 5 條
5. 使用繁體中文回覆`;
  }

  buildPrompt(
    forecasts: IngredientForecastItem[],
    dateRange: { startDate: string; endDate: string },
    holidayContext: string[],
  ): string {
    const forecastSummary = forecasts
      .slice(0, 30) // Limit to top 30 to control token usage
      .map(
        (f) =>
          `- ${f.ingredientName} (ID:${f.ingredientId}): 預測 ${f.predictedQuantity} ${f.unit}, 信心度 ${Math.round(f.confidence * 100)}%${f.currentStock !== undefined ? `, 庫存 ${f.currentStock} ${f.unit}` : ""}`,
      )
      .join("\n");

    const holidayInfo =
      holidayContext.length > 0
        ? `\n日期脈絡：${holidayContext.join("、")}`
        : "";

    return `以下是 ${dateRange.startDate} 至 ${dateRange.endDate} 的食材需求統計預測結果：

${forecastSummary}
${holidayInfo}

請根據以上數據和日期脈絡，分析是否需要調整預測量，並提供採購建議。`;
  }

  private parseResponse(content: string): LLMResponse {
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { adjustments: [], recommendations: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]) as LLMResponse;
      return {
        adjustments: Array.isArray(parsed.adjustments)
          ? parsed.adjustments
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.slice(0, 5)
          : [],
      };
    } catch {
      return { adjustments: [], recommendations: [] };
    }
  }

  private applyAdjustments(
    forecasts: IngredientForecastItem[],
    adjustments: LLMAdjustment[],
  ): IngredientForecastItem[] {
    const adjustmentMap = new Map(
      adjustments.map((a) => [a.ingredientId, a.adjustmentFactor]),
    );

    return forecasts.map((forecast) => {
      const factor = adjustmentMap.get(forecast.ingredientId);
      if (factor === undefined) return forecast;

      // Clamp adjustment factor to safe range [0.5, 2.0]
      const clampedFactor = Math.max(0.5, Math.min(2.0, factor));
      const adjustedQuantity =
        Math.round(forecast.predictedQuantity * clampedFactor * 100) / 100;
      const adjustedGap =
        forecast.currentStock !== undefined
          ? Math.round((adjustedQuantity - forecast.currentStock) * 100) / 100
          : undefined;

      return {
        ...forecast,
        predictedQuantity: adjustedQuantity,
        gap:
          adjustedGap !== undefined && adjustedGap > 0
            ? adjustedGap
            : undefined,
      };
    });
  }

  getHolidayContext(dateStr: string): string[] {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const context: string[] = [];

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      context.push("週末");
    }

    // Taiwan national holidays (fixed dates)
    const fixedHolidays: Record<string, string> = {
      "1-1": "元旦",
      "2-28": "和平紀念日",
      "4-4": "兒童節",
      "4-5": "清明節",
      "5-1": "勞動節",
      "10-10": "國慶日",
    };
    const key = `${month}-${day}`;
    if (fixedHolidays[key]) {
      context.push(fixedHolidays[key]);
    }

    // Approximate lunar holidays by month range
    if (month === 1 || month === 2) {
      context.push("農曆新年期間（可能）");
    }
    if (month === 9) {
      context.push("中秋節期間（可能）");
    }
    if (month === 6) {
      context.push("端午節期間（可能）");
    }

    // Seasonal context
    if (month >= 6 && month <= 8) {
      context.push("夏季（冷飲/冰品需求增加）");
    } else if (month >= 12 || month <= 2) {
      context.push("冬季（火鍋/熱湯需求增加）");
    }

    return context;
  }
}
