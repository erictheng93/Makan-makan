// apps/api/src/features/forecast/services/ForecastService.ts
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import {
  forecastCache,
  menuItems,
  orders,
  orderItems,
} from "@makanmakan/database";
import type {
  ForecastResult,
  ForecastItemResult,
  ForecastAccuracyItem,
  ForecastAlert,
  ForecastMetadata,
  GenerateForecastOptions,
  IForecastService,
} from "../types";

const WEIGHTS = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
const KV_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const HISTORICAL_WEEKS = 4;

interface CachedItemData {
  predicted: number;
  confidence: number;
  trend: string;
  menuItemName?: string;
  trendPercent?: number;
  historicalAvg?: number;
}

export class ForecastService implements IForecastService {
  private db;

  constructor(
    d1: D1Database,
    private kv: KVNamespace,
  ) {
    this.db = drizzle(d1);
  }

  async generateForecast(
    restaurantId: string,
    options: GenerateForecastOptions,
  ): Promise<ForecastResult[]> {
    const { startDate, endDate, type = "item_level", useAI = false } = options;
    const dates = this.getDateRange(startDate, endDate);
    const results: ForecastResult[] = [];

    for (const date of dates) {
      try {
        const weekday = new Date(date).getDay();
        const historicalData = await this.getHistoricalSales(
          restaurantId,
          date,
          weekday,
        );

        const items: ForecastItemResult[] = [];
        for (const [menuItemId, weeklyData] of Object.entries(historicalData)) {
          const item = this.calculatePrediction(Number(menuItemId), weeklyData);
          if (item) items.push(item);
        }

        const generatedBy = useAI ? "ai_enhanced" : "statistical";

        const metadata: ForecastMetadata = {
          dataSourceDays: HISTORICAL_WEEKS * 7,
          model: useAI ? "wma+ai" : "weighted_moving_average",
          weights: WEIGHTS,
          generatedAt: new Date().toISOString(),
        };

        const forecast: ForecastResult = {
          date,
          type,
          items,
          generatedBy,
          metadata,
        };
        results.push(forecast);

        await this.saveForecastToDb(restaurantId, forecast);

        const kvKey = `forecast:${restaurantId}:${date}:${type}`;
        await this.kv.put(kvKey, JSON.stringify([forecast]), {
          expirationTtl: KV_TTL_SECONDS,
        });
      } catch (error) {
        const staleResult = await this.getStaleCache(restaurantId, date, type);
        if (staleResult) {
          staleResult.stale = true;
          results.push(staleResult);
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  private async getStaleCache(
    restaurantId: string,
    date: string,
    type: string,
  ): Promise<ForecastResult | null> {
    const dbResult = await this.db
      .select({
        data: forecastCache.data,
        metadata: forecastCache.metadata,
        generatedBy: forecastCache.generatedBy,
      })
      .from(forecastCache)
      .where(
        and(
          eq(forecastCache.restaurantId, restaurantId),
          eq(forecastCache.forecastDate, date),
          eq(forecastCache.forecastType, type),
        ),
      )
      .limit(1);

    if (!dbResult.length) return null;

    const row = dbResult[0];
    const dataDict = (row.data as Record<string, CachedItemData> | null) || {};
    const items: ForecastItemResult[] = Object.entries(dataDict).map(
      ([id, v]) => ({
        menuItemId: Number(id),
        menuItemName: v.menuItemName || "",
        predicted: v.predicted,
        confidence: v.confidence,
        trend: v.trend as "up" | "down" | "stable",
        trendPercent: v.trendPercent || 0,
        historicalAvg: v.historicalAvg || 0,
      }),
    );

    return {
      date,
      type: type as "item_level" | "ingredient_level",
      items,
      generatedBy: row.generatedBy as "statistical" | "ai_enhanced",
      metadata: row.metadata as ForecastMetadata,
      stale: true,
    };
  }

  async getForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
    type: string = "item_level",
  ): Promise<ForecastResult[]> {
    const dates = this.getDateRange(startDate, endDate);
    const results: ForecastResult[] = [];

    for (const date of dates) {
      const kvKey = `forecast:${restaurantId}:${date}:${type}`;
      const cached = await this.kv.get(kvKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ForecastResult[];
        results.push(...parsed);
        continue;
      }

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
            eq(forecastCache.forecastType, type),
          ),
        )
        .limit(1);

      if (
        dbResult.length &&
        (!dbResult[0].expiresAt || dbResult[0].expiresAt.getTime() > Date.now())
      ) {
        const row = dbResult[0];
        const dataDict =
          (row.data as Record<string, CachedItemData> | null) || {};
        const items: ForecastItemResult[] = Object.entries(dataDict).map(
          ([id, v]) => ({
            menuItemId: Number(id),
            menuItemName: v.menuItemName || "",
            predicted: v.predicted,
            confidence: v.confidence,
            trend: v.trend as "up" | "down" | "stable",
            trendPercent: v.trendPercent || 0,
            historicalAvg: v.historicalAvg || 0,
          }),
        );

        const forecast: ForecastResult = {
          date,
          type: type as "item_level" | "ingredient_level",
          items,
          generatedBy: row.generatedBy as "statistical" | "ai_enhanced",
          metadata: row.metadata as ForecastMetadata,
        };
        results.push(forecast);
        await this.kv.put(kvKey, JSON.stringify([forecast]), {
          expirationTtl: KV_TTL_SECONDS,
        });
        continue;
      }

      const generated = await this.generateForecast(restaurantId, {
        startDate: date,
        endDate: date,
        type: type as "item_level" | "ingredient_level",
      });
      results.push(...generated);
    }

    return results;
  }

  async getAccuracy(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<ForecastAccuracyItem[]> {
    const forecasts = await this.db
      .select({
        forecastDate: forecastCache.forecastDate,
        data: forecastCache.data,
      })
      .from(forecastCache)
      .where(
        and(
          eq(forecastCache.restaurantId, restaurantId),
          sql`${forecastCache.forecastDate} >= ${startDate}`,
          sql`${forecastCache.forecastDate} <= ${endDate}`,
          eq(forecastCache.forecastType, "item_level"),
        ),
      );

    if (!forecasts.length) return [];

    const menuItemIds = new Set<number>();
    for (const f of forecasts) {
      const data = (f.data as Record<string, unknown>) || {};
      for (const id of Object.keys(data)) menuItemIds.add(Number(id));
    }
    const nameMap = new Map<number, string>();
    if (menuItemIds.size > 0) {
      // D1 has a 100-parameter binding limit; chunk large sets
      const idArray = [...menuItemIds];
      const CHUNK_SIZE = 90;
      for (let i = 0; i < idArray.length; i += CHUNK_SIZE) {
        const chunk = idArray.slice(i, i + CHUNK_SIZE);
        const names = await this.db
          .select({ id: menuItems.id, name: menuItems.name })
          .from(menuItems)
          .where(inArray(menuItems.id, chunk));
        for (const row of names) nameMap.set(row.id, row.name);
      }
    }

    const actuals = await this.db
      .select({
        menuItemId: orderItems.menuItemId,
        itemName: menuItems.name,
        actualQuantity: sql<number>`SUM(${orderItems.quantity})`,
        orderDate: sql<string>`DATE(${orders.createdAt} / 1000, 'unixepoch')`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          inArray(orders.status, [
            "confirmed",
            "preparing",
            "ready",
            "delivered",
            "paid",
          ]),
          sql`${orderItems.status} != 'cancelled'`,
          sql`DATE(${orders.createdAt} / 1000, 'unixepoch') >= ${startDate}`,
          sql`DATE(${orders.createdAt} / 1000, 'unixepoch') <= ${endDate}`,
        ),
      )
      .groupBy(
        orderItems.menuItemId,
        sql`DATE(${orders.createdAt} / 1000, 'unixepoch')`,
      );

    const actualMap = new Map<string, Map<number, number>>();
    for (const row of actuals) {
      if (!actualMap.has(row.orderDate))
        actualMap.set(row.orderDate, new Map());
      actualMap.get(row.orderDate)!.set(row.menuItemId, row.actualQuantity);
    }

    const accuracyItems: ForecastAccuracyItem[] = [];
    for (const forecast of forecasts) {
      const predictions: Record<string, { predicted: number }> =
        (forecast.data as Record<string, { predicted: number }>) || {};
      const dateActuals = actualMap.get(forecast.forecastDate) || new Map();

      for (const [menuItemIdStr, pred] of Object.entries(predictions)) {
        const menuItemId = Number(menuItemIdStr);
        const actual = dateActuals.get(menuItemId) || 0;
        const deviation =
          pred.predicted > 0
            ? (Math.abs(actual - pred.predicted) / pred.predicted) * 100
            : 0;
        const menuItemName = nameMap.get(menuItemId) || `Item #${menuItemId}`;

        accuracyItems.push({
          menuItemId,
          menuItemName,
          predicted: pred.predicted,
          actual,
          deviation: Math.round(deviation * 10) / 10,
        });
      }
    }

    return accuracyItems;
  }

  async getAlerts(restaurantId: string): Promise<ForecastAlert[]> {
    const alerts: ForecastAlert[] = [];
    const tomorrow = this.formatDate(new Date(Date.now() + 86400000));

    const forecasts = await this.getForecast(restaurantId, tomorrow, tomorrow);
    if (!forecasts.length || !forecasts[0].items.length) return [];

    const menuItemRows = await this.db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        inventoryCount: menuItems.inventoryCount,
      })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, restaurantId),
          eq(menuItems.isAvailable, true),
          isNull(menuItems.deletedAt),
        ),
      );

    const inventoryMap = new Map(menuItemRows.map((m) => [m.id, m]));

    for (const item of forecasts[0].items) {
      const menuItem = inventoryMap.get(item.menuItemId);
      if (!menuItem) continue;

      if (item.predicted > 30 && item.confidence >= 0.7) {
        alerts.push({
          type: "high_demand",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `明日預估高需求：${Math.ceil(item.predicted)} 份，請提前備料`,
          severity: item.predicted > 50 ? "warning" : "info",
          data: { predicted: item.predicted, confidence: item.confidence },
        });
      }

      if (
        menuItem.inventoryCount !== null &&
        item.predicted > menuItem.inventoryCount
      ) {
        alerts.push({
          type: "low_stock",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `預估需要 ${Math.ceil(item.predicted)} 份，但庫存只有 ${menuItem.inventoryCount} 份`,
          severity:
            item.predicted > menuItem.inventoryCount * 2
              ? "critical"
              : "warning",
        });
      }

      if (item.historicalAvg > 0 && item.predicted > item.historicalAvg * 1.5) {
        alerts.push({
          type: "unusual_spike",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `預估量 ${Math.ceil(item.predicted)} 份，比平均 ${Math.round(item.historicalAvg)} 份高出 ${Math.round(item.trendPercent)}%`,
          severity:
            item.predicted > item.historicalAvg * 2 ? "warning" : "info",
        });
      }
    }

    // --- Ingredient-level alerts ---
    try {
      const ingredientForecasts = await this.db
        .select({
          data: forecastCache.data,
        })
        .from(forecastCache)
        .where(
          and(
            eq(forecastCache.restaurantId, restaurantId),
            eq(forecastCache.forecastDate, tomorrow),
            eq(forecastCache.forecastType, "ingredient_level"),
          ),
        )
        .limit(1);

      if (ingredientForecasts.length) {
        const ingredients = ingredientForecasts[0].data as unknown as Array<{
          ingredientId: number;
          ingredientName: string;
          unit: string;
          predictedQuantity: number;
          currentStock?: number;
        }>;

        for (const ing of ingredients) {
          if (ing.currentStock === undefined || ing.currentStock === null)
            continue;

          // Procurement needed: predicted > currentStock
          if (ing.predictedQuantity > ing.currentStock) {
            const gap =
              Math.round((ing.predictedQuantity - ing.currentStock) * 100) /
              100;
            const ratio =
              ing.currentStock > 0
                ? ing.predictedQuantity / ing.currentStock
                : 10;
            alerts.push({
              type: "procurement_needed",
              menuItemId: 0,
              menuItemName: "",
              ingredientId: ing.ingredientId,
              ingredientName: ing.ingredientName,
              message: `${ing.ingredientName} 需採購：預測需要 ${ing.predictedQuantity} ${ing.unit}，庫存僅 ${ing.currentStock} ${ing.unit}，缺口 ${gap} ${ing.unit}`,
              severity: ratio > 2 ? "critical" : "warning",
              data: {
                predicted: ing.predictedQuantity,
                currentStock: ing.currentStock,
                gap,
                unit: ing.unit,
              },
            });
          }

          // Excess stock: currentStock > predicted x 3
          if (
            ing.currentStock > ing.predictedQuantity * 3 &&
            ing.predictedQuantity > 0
          ) {
            alerts.push({
              type: "excess_stock",
              menuItemId: 0,
              menuItemName: "",
              ingredientId: ing.ingredientId,
              ingredientName: ing.ingredientName,
              message: `${ing.ingredientName} 庫存過量：庫存 ${ing.currentStock} ${ing.unit}，預測僅需 ${ing.predictedQuantity} ${ing.unit}`,
              severity: "info",
              data: {
                predicted: ing.predictedQuantity,
                currentStock: ing.currentStock,
                unit: ing.unit,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Ingredient alert generation error:", error);
      // Don't fail the whole alert generation if ingredient alerts fail
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async getHistoricalSales(
    restaurantId: string,
    targetDate: string,
    weekday: number,
  ): Promise<Record<string, { name: string; weeklySales: number[] }>> {
    const result = await this.db
      .select({
        menuItemId: orderItems.menuItemId,
        itemName: menuItems.name,
        quantitySum: sql<number>`SUM(${orderItems.quantity})`,
        orderDate: sql<string>`DATE(${orders.createdAt} / 1000, 'unixepoch')`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          inArray(orders.status, [
            "confirmed",
            "preparing",
            "ready",
            "delivered",
            "paid",
          ]),
          sql`${orderItems.status} != 'cancelled'`,
          sql`CAST(strftime('%w', ${orders.createdAt} / 1000, 'unixepoch') AS INTEGER) = ${weekday}`,
          sql`DATE(${orders.createdAt} / 1000, 'unixepoch') >= DATE(${targetDate}, '-' || ${HISTORICAL_WEEKS * 7} || ' days')`,
          sql`DATE(${orders.createdAt} / 1000, 'unixepoch') < ${targetDate}`,
        ),
      )
      .groupBy(
        orderItems.menuItemId,
        sql`DATE(${orders.createdAt} / 1000, 'unixepoch')`,
      )
      .orderBy(sql`DATE(${orders.createdAt} / 1000, 'unixepoch') DESC`);

    const grouped: Record<string, { name: string; weeklySales: number[] }> = {};
    for (const row of result) {
      if (!grouped[row.menuItemId]) {
        grouped[row.menuItemId] = { name: row.itemName, weeklySales: [] };
      }
      grouped[row.menuItemId].weeklySales.push(row.quantitySum);
    }

    return grouped;
  }

  private calculatePrediction(
    menuItemId: number,
    data: { name: string; weeklySales: number[] },
  ): ForecastItemResult | null {
    const { name, weeklySales } = data;
    if (weeklySales.length === 0) return null;

    const weightKeys = Object.keys(WEIGHTS).map(Number);
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < weeklySales.length && i < weightKeys.length; i++) {
      const weight = WEIGHTS[(i + 1) as keyof typeof WEIGHTS];
      weightedSum += weeklySales[i] * weight;
      weightTotal += weight;
    }
    const predicted = weightTotal > 0 ? weightedSum / weightTotal : 0;

    const historicalAvg =
      weeklySales.reduce((a, b) => a + b, 0) / weeklySales.length;
    const recentAvg =
      weeklySales.slice(0, 2).reduce((a, b) => a + b, 0) /
      Math.min(weeklySales.length, 2);
    const olderAvg =
      weeklySales.slice(2).length > 0
        ? weeklySales.slice(2).reduce((a, b) => a + b, 0) /
          weeklySales.slice(2).length
        : recentAvg;
    const trendPercent =
      olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    const adjustedPredicted = predicted * (1 + (trendPercent / 100) * 0.5);

    const variance =
      weeklySales.reduce((sum, v) => sum + Math.pow(v - historicalAvg, 2), 0) /
      weeklySales.length;
    const stdDev = Math.sqrt(variance);
    const cv = historicalAvg > 0 ? stdDev / historicalAvg : 1;
    const confidence = Math.max(0, Math.min(1, 1 - cv));

    return {
      menuItemId,
      menuItemName: name,
      predicted: Math.round(adjustedPredicted * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      trend: trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable",
      trendPercent: Math.round(trendPercent * 10) / 10,
      historicalAvg: Math.round(historicalAvg * 10) / 10,
    };
  }

  private async saveForecastToDb(
    restaurantId: string,
    forecast: ForecastResult,
  ): Promise<void> {
    const dataJson: Record<string, CachedItemData> = {};
    for (const item of forecast.items) {
      dataJson[item.menuItemId] = {
        predicted: item.predicted,
        confidence: item.confidence,
        trend: item.trend,
        menuItemName: item.menuItemName,
        trendPercent: item.trendPercent,
        historicalAvg: item.historicalAvg,
      };
    }

    await this.db
      .insert(forecastCache)
      .values({
        restaurantId,
        forecastDate: forecast.date,
        forecastType: forecast.type,
        data: dataJson as any,
        metadata: forecast.metadata as any,
        generatedBy: forecast.generatedBy,
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
          data: dataJson as any,
          metadata: forecast.metadata as any,
          generatedBy: forecast.generatedBy,
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
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
