import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull } from "drizzle-orm";
import {
  forecastCache,
  menuItems,
  menuItemIngredients,
  ingredientDefinitions,
} from "@makanmasak/database";
import type {
  IngredientForecastItem,
  IngredientForecastResult,
  IngredientForecastContributingItem,
} from "@makanmasak/shared-types";
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
  private db;
  private aiEnhancer: AIForecastEnhancer | null = null;

  constructor(
    d1: D1Database,
    private kv: KVNamespace,
    private forecastService: ForecastService,
    encryptionKey?: string,
  ) {
    this.db = drizzle(d1);
    if (encryptionKey) {
      this.aiEnhancer = new AIForecastEnhancer(d1, encryptionKey);
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
        .select({
          data: forecastCache.data,
          metadata: forecastCache.metadata,
          generatedBy: forecastCache.generatedBy,
          expiresAt: forecastCache.expiresAt,
        })
        .from(forecastCache)
        .where(
          and(
            eq(forecastCache.restaurantId, restaurantId),
            eq(forecastCache.forecastDate, date),
            eq(forecastCache.forecastType, "ingredient_level"),
          ),
        )
        .limit(1);

      if (
        dbResult.length &&
        (!dbResult[0].expiresAt || dbResult[0].expiresAt.getTime() > Date.now())
      ) {
        const row = dbResult[0];
        const result: IngredientForecastResult = {
          date,
          ingredients: row.data as unknown as IngredientForecastItem[],
          generatedBy: row.generatedBy as "statistical" | "ai_enhanced",
          metadata: row.metadata as {
            dataSourceDays: number;
            model: string;
            generatedAt: string;
          },
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
      .select({
        menuItemId: menuItemIngredients.menuItemId,
        ingredientId: menuItemIngredients.ingredientId,
        quantityPerServing: menuItemIngredients.quantityPerServing,
        unit: menuItemIngredients.unit,
        ingredientName: ingredientDefinitions.name,
        currentStock: ingredientDefinitions.currentStock,
      })
      .from(menuItemIngredients)
      .innerJoin(
        ingredientDefinitions,
        eq(menuItemIngredients.ingredientId, ingredientDefinitions.id),
      )
      .innerJoin(menuItems, eq(menuItemIngredients.menuItemId, menuItems.id))
      .where(
        and(
          eq(menuItems.restaurantId, restaurantId),
          // Read-side twin of the ownership check RecipeService.setRecipe
          // gained in #274. Scoping only the dish side would let a BOM row
          // that names a foreign ingredient pull that ingredient's name and
          // currentStock into this restaurant's forecast. setRecipe is the
          // only writer and is now scoped, so this is defence in depth rather
          // than a live hole — but it stops the guarantee resting on "the
          // write path must always have been correct".
          eq(ingredientDefinitions.restaurantId, restaurantId),
          eq(ingredientDefinitions.isActive, true),
          isNull(ingredientDefinitions.deletedAt),
          isNull(menuItems.deletedAt),
        ),
      );

    const bom: BOMMap = {};
    for (const row of rows) {
      if (!bom[row.menuItemId]) bom[row.menuItemId] = [];
      bom[row.menuItemId].push({
        ingredientId: row.ingredientId,
        ingredientName: row.ingredientName,
        unit: row.unit,
        quantityPerServing: row.quantityPerServing,
        currentStock: row.currentStock,
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
      .insert(forecastCache)
      .values({
        restaurantId,
        forecastDate: date,
        forecastType: "ingredient_level",
        data: result.ingredients as unknown as Record<
          string,
          { predicted: number; confidence: number; trend: string }
        >,
        metadata: { ...result.metadata, weights: {} },
        generatedBy: result.generatedBy,
        expiresAt: new Date(Date.now() + KV_TTL_SECONDS * 1000),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          forecastCache.restaurantId,
          forecastCache.forecastDate,
          forecastCache.forecastType,
        ],
        set: {
          data: result.ingredients as unknown as Record<
            string,
            { predicted: number; confidence: number; trend: string }
          >,
          metadata: { ...result.metadata, weights: {} },
          generatedBy: result.generatedBy,
          expiresAt: new Date(Date.now() + KV_TTL_SECONDS * 1000),
          createdAt: new Date(),
        },
      });
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
