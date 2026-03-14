import type {
  IngredientForecastItem,
  IngredientForecastResult,
  IngredientForecastContributingItem,
} from "@makanmakan/shared-types";
import type { ForecastService } from "./ForecastService";
import { AIForecastEnhancer } from "./AIForecastEnhancer";

interface RecipeEntry {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantityPerServing: number;
  currentStock: number | null;
}

interface BOMMap {
  // menuItemId -> RecipeEntry[]
  [menuItemId: number]: RecipeEntry[];
}

const KV_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export class IngredientForecastService {
  private aiEnhancer: AIForecastEnhancer | null = null;

  constructor(
    private db: D1Database,
    private kv: KVNamespace,
    private forecastService: ForecastService,
    encryptionKey?: string,
  ) {
    if (encryptionKey) {
      this.aiEnhancer = new AIForecastEnhancer(db, encryptionKey);
    }
  }

  async generateIngredientForecast(
    restaurantId: string,
    options: {
      startDate: string;
      endDate: string;
      useAI?: boolean;
    },
  ): Promise<IngredientForecastResult[]> {
    // 1. Get item-level forecasts
    const itemForecasts = await this.forecastService.generateForecast(
      restaurantId,
      {
        startDate: options.startDate,
        endDate: options.endDate,
        type: "item_level",
        useAI: options.useAI,
      },
    );

    // 2. Load BOM (Bill of Materials)
    const bom = await this.loadBOM(restaurantId);

    // 3. Explode forecasts into ingredient-level predictions
    const results: IngredientForecastResult[] = [];

    for (const forecast of itemForecasts) {
      let ingredients = this.explodeForecast(forecast.items, bom);
      let generatedBy = forecast.generatedBy;

      // AI enhancement if requested and available
      if (options.useAI && this.aiEnhancer && ingredients.length > 0) {
        try {
          const enhanced = await this.aiEnhancer.enhancePredictions(
            restaurantId,
            ingredients,
            { startDate: options.startDate, endDate: options.endDate },
          );
          ingredients = enhanced.enhancedForecasts;
          generatedBy = "ai_enhanced";
        } catch (error) {
          console.error(
            "[IngredientForecast] AI enhancement failed, using statistical:",
            error,
          );
        }
      }

      const result: IngredientForecastResult = {
        date: forecast.date,
        ingredients,
        generatedBy,
        metadata: {
          dataSourceDays: forecast.metadata.dataSourceDays,
          model: forecast.metadata.model,
          generatedAt: new Date().toISOString(),
        },
      };
      results.push(result);

      // Cache as ingredient_level
      const kvKey = `forecast:ingredient:${restaurantId}:${forecast.date}`;
      await this.kv.put(kvKey, JSON.stringify(result), {
        expirationTtl: KV_TTL_SECONDS,
      });

      // Also save to DB
      await this.saveForecastToDb(restaurantId, forecast.date, result);
    }

    return results;
  }

  async getIngredientForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<IngredientForecastResult[]> {
    const dates = this.getDateRange(startDate, endDate);
    const results: IngredientForecastResult[] = [];

    for (const date of dates) {
      // Try KV cache first
      const kvKey = `forecast:ingredient:${restaurantId}:${date}`;
      const cached = await this.kv.get(kvKey);
      if (cached) {
        results.push(JSON.parse(cached));
        continue;
      }

      // Try DB fallback
      const dbResult = await this.db
        .prepare(
          "SELECT data, metadata, generated_by FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = 'ingredient_level' LIMIT 1",
        )
        .bind(restaurantId, date)
        .first<{ data: string; metadata: string; generated_by: string }>();

      if (dbResult) {
        const result: IngredientForecastResult = {
          date,
          ingredients: JSON.parse(dbResult.data),
          generatedBy: dbResult.generated_by as "statistical" | "ai_enhanced",
          metadata: JSON.parse(dbResult.metadata),
        };
        results.push(result);
        // Repopulate KV cache
        await this.kv.put(kvKey, JSON.stringify(result), {
          expirationTtl: KV_TTL_SECONDS,
        });
        continue;
      }

      // On-demand generation
      const generated = await this.generateIngredientForecast(restaurantId, {
        startDate: date,
        endDate: date,
      });
      results.push(...generated);
    }

    return results;
  }

  private async loadBOM(restaurantId: string): Promise<BOMMap> {
    const rows = await this.db
      .prepare(
        `SELECT mii.menu_item_id, mii.ingredient_id, mii.quantity_per_serving, mii.unit,
                id_def.name as ingredient_name, id_def.current_stock
         FROM menu_item_ingredients mii
         JOIN ingredient_definitions id_def ON mii.ingredient_id = id_def.id
         JOIN menu_items mi ON mii.menu_item_id = mi.id
         WHERE mi.restaurant_id = ?
         AND id_def.is_active = 1
         AND id_def.deleted_at_ms IS NULL
         AND mi.deleted_at_ms IS NULL`,
      )
      .bind(restaurantId)
      .all<{
        menu_item_id: number;
        ingredient_id: number;
        quantity_per_serving: number;
        unit: string;
        ingredient_name: string;
        current_stock: number | null;
      }>();

    const bom: BOMMap = {};
    for (const row of rows.results) {
      if (!bom[row.menu_item_id]) bom[row.menu_item_id] = [];
      bom[row.menu_item_id].push({
        ingredientId: row.ingredient_id,
        ingredientName: row.ingredient_name,
        unit: row.unit,
        quantityPerServing: row.quantity_per_serving,
        currentStock: row.current_stock,
      });
    }
    return bom;
  }

  private explodeForecast(
    itemForecasts: {
      menuItemId: number;
      menuItemName: string;
      predicted: number;
      confidence: number;
    }[],
    bom: BOMMap,
  ): IngredientForecastItem[] {
    // Accumulate ingredient demands across all menu items
    const ingredientMap = new Map<
      number,
      {
        ingredientName: string;
        unit: string;
        totalQuantity: number;
        currentStock: number | null;
        contributingItems: IngredientForecastContributingItem[];
        // For weighted confidence calculation
        confidenceWeightedSum: number;
        totalContribution: number;
      }
    >();

    for (const item of itemForecasts) {
      const recipes = bom[item.menuItemId];
      if (!recipes) continue; // No recipe for this item — skip

      for (const recipe of recipes) {
        const quantity = item.predicted * recipe.quantityPerServing;
        const existing = ingredientMap.get(recipe.ingredientId);

        if (existing) {
          existing.totalQuantity += quantity;
          existing.contributingItems.push({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            quantity: Math.round(quantity * 100) / 100,
          });
          existing.confidenceWeightedSum += item.confidence * quantity;
          existing.totalContribution += quantity;
        } else {
          ingredientMap.set(recipe.ingredientId, {
            ingredientName: recipe.ingredientName,
            unit: recipe.unit,
            totalQuantity: quantity,
            currentStock: recipe.currentStock,
            contributingItems: [
              {
                menuItemId: item.menuItemId,
                menuItemName: item.menuItemName,
                quantity: Math.round(quantity * 100) / 100,
              },
            ],
            confidenceWeightedSum: item.confidence * quantity,
            totalContribution: quantity,
          });
        }
      }
    }

    // Convert to result array
    const results: IngredientForecastItem[] = [];
    for (const [ingredientId, data] of ingredientMap) {
      const predictedQuantity = Math.round(data.totalQuantity * 100) / 100;
      const confidence =
        data.totalContribution > 0
          ? Math.round(
              (data.confidenceWeightedSum / data.totalContribution) * 100,
            ) / 100
          : 0;
      const gap =
        data.currentStock !== null
          ? Math.round((predictedQuantity - data.currentStock) * 100) / 100
          : undefined;

      results.push({
        ingredientId,
        ingredientName: data.ingredientName,
        unit: data.unit,
        predictedQuantity,
        confidence,
        contributingItems: data.contributingItems,
        currentStock: data.currentStock ?? undefined,
        gap: gap !== undefined && gap > 0 ? gap : undefined,
      });
    }

    // Sort by predicted quantity descending
    return results.sort((a, b) => b.predictedQuantity - a.predictedQuantity);
  }

  private async saveForecastToDb(
    restaurantId: string,
    date: string,
    result: IngredientForecastResult,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO forecast_cache (restaurant_id, forecast_date, forecast_type, data, metadata, generated_by, expires_at_ms, created_at_ms)
         VALUES (?, ?, 'ingredient_level', ?, ?, ?, ?, ?)`,
      )
      .bind(
        restaurantId,
        date,
        JSON.stringify(result.ingredients),
        JSON.stringify(result.metadata),
        result.generatedBy,
        Date.now() + KV_TTL_SECONDS * 1000,
        Date.now(),
      )
      .run();
  }

  private getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
}
