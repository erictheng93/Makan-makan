// apps/api/src/features/forecast/services/ForecastService.ts
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
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

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
      .prepare(
        "SELECT data, metadata, generated_by FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = ? LIMIT 1",
      )
      .bind(restaurantId, date, type)
      .first<{ data: string; metadata: string; generated_by: string }>();

    if (!dbResult) return null;

    const dataDict =
      (JSON.parse(dbResult.data) as Record<string, CachedItemData>) || {};
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
      generatedBy: dbResult.generated_by as "statistical" | "ai_enhanced",
      metadata: JSON.parse(dbResult.metadata),
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
        .prepare(
          "SELECT data, metadata, generated_by, expires_at_ms FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = ? LIMIT 1",
        )
        .bind(restaurantId, date, type)
        .first<{
          data: string;
          metadata: string;
          generated_by: string;
          expires_at_ms: number;
        }>();

      if (
        dbResult &&
        (!dbResult.expires_at_ms || dbResult.expires_at_ms > Date.now())
      ) {
        const dataDict =
          (JSON.parse(dbResult.data) as Record<string, CachedItemData>) || {};
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
          generatedBy: dbResult.generated_by as "statistical" | "ai_enhanced",
          metadata: JSON.parse(dbResult.metadata),
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
      .prepare(
        "SELECT forecast_date, data FROM forecast_cache WHERE restaurant_id = ? AND forecast_date >= ? AND forecast_date <= ? AND forecast_type = 'item_level'",
      )
      .bind(restaurantId, startDate, endDate)
      .all<{ forecast_date: string; data: string }>();

    if (!forecasts.results.length) return [];

    const menuItemIds = new Set<number>();
    for (const f of forecasts.results) {
      const data = JSON.parse(f.data) || {};
      for (const id of Object.keys(data)) menuItemIds.add(Number(id));
    }
    const nameMap = new Map<number, string>();
    if (menuItemIds.size > 0) {
      // D1 has a 100-parameter binding limit; chunk large sets
      const idArray = [...menuItemIds];
      const CHUNK_SIZE = 90;
      for (let i = 0; i < idArray.length; i += CHUNK_SIZE) {
        const chunk = idArray.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "?").join(",");
        const names = await this.db
          .prepare(
            `SELECT id, name FROM menu_items WHERE id IN (${placeholders})`,
          )
          .bind(...chunk)
          .all<{ id: number; name: string }>();
        for (const row of names.results) nameMap.set(row.id, row.name);
      }
    }

    const actuals = await this.db
      .prepare(
        `SELECT oi.menu_item_id, mi.name as item_name, SUM(oi.quantity) as actual_quantity,
                DATE(o.created_at_ms / 1000, 'unixepoch') as order_date
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE o.restaurant_id = ? AND o.status IN ('confirmed','preparing','ready','delivered','paid')
         AND oi.status != 'cancelled'
         AND DATE(o.created_at_ms / 1000, 'unixepoch') >= ? AND DATE(o.created_at_ms / 1000, 'unixepoch') <= ?
         GROUP BY oi.menu_item_id, order_date`,
      )
      .bind(restaurantId, startDate, endDate)
      .all<{
        menu_item_id: number;
        item_name: string;
        actual_quantity: number;
        order_date: string;
      }>();

    const actualMap = new Map<string, Map<number, number>>();
    for (const row of actuals.results) {
      if (!actualMap.has(row.order_date))
        actualMap.set(row.order_date, new Map());
      actualMap.get(row.order_date)!.set(row.menu_item_id, row.actual_quantity);
    }

    const accuracyItems: ForecastAccuracyItem[] = [];
    for (const forecast of forecasts.results) {
      const predictions: Record<string, { predicted: number }> =
        JSON.parse(forecast.data) || {};
      const dateActuals = actualMap.get(forecast.forecast_date) || new Map();

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

    const menuItems = await this.db
      .prepare(
        "SELECT id, name, inventory_count FROM menu_items WHERE restaurant_id = ? AND is_available = 1 AND deleted_at_ms IS NULL",
      )
      .bind(restaurantId)
      .all<{ id: number; name: string; inventory_count: number | null }>();

    const inventoryMap = new Map(menuItems.results.map((m) => [m.id, m]));

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
        menuItem.inventory_count !== null &&
        item.predicted > menuItem.inventory_count
      ) {
        alerts.push({
          type: "low_stock",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `預估需要 ${Math.ceil(item.predicted)} 份，但庫存只有 ${menuItem.inventory_count} 份`,
          severity:
            item.predicted > menuItem.inventory_count * 2
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
        .prepare(
          "SELECT data FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = 'ingredient_level' LIMIT 1",
        )
        .bind(restaurantId, tomorrow)
        .first<{ data: string }>();

      if (ingredientForecasts) {
        const ingredients = JSON.parse(ingredientForecasts.data) as Array<{
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

          // Excess stock: currentStock > predicted × 3
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
      .prepare(
        `SELECT oi.menu_item_id, mi.name as item_name, SUM(oi.quantity) as quantity_sum,
                DATE(o.created_at_ms / 1000, 'unixepoch') as order_date
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE o.restaurant_id = ?
         AND o.status IN ('confirmed','preparing','ready','delivered','paid')
         AND oi.status != 'cancelled'
         AND CAST(strftime('%w', o.created_at_ms / 1000, 'unixepoch') AS INTEGER) = ?
         AND DATE(o.created_at_ms / 1000, 'unixepoch') >= DATE(?, '-' || ? || ' days')
         AND DATE(o.created_at_ms / 1000, 'unixepoch') < ?
         GROUP BY oi.menu_item_id, order_date
         ORDER BY order_date DESC`,
      )
      .bind(restaurantId, weekday, targetDate, HISTORICAL_WEEKS * 7, targetDate)
      .all<{
        menu_item_id: number;
        item_name: string;
        quantity_sum: number;
        order_date: string;
      }>();

    const grouped: Record<string, { name: string; weeklySales: number[] }> = {};
    for (const row of result.results) {
      if (!grouped[row.menu_item_id]) {
        grouped[row.menu_item_id] = { name: row.item_name, weeklySales: [] };
      }
      grouped[row.menu_item_id].weeklySales.push(row.quantity_sum);
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
      .prepare(
        `INSERT OR REPLACE INTO forecast_cache (restaurant_id, forecast_date, forecast_type, data, metadata, generated_by, expires_at_ms, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        restaurantId,
        forecast.date,
        forecast.type,
        JSON.stringify(dataJson),
        JSON.stringify(forecast.metadata),
        forecast.generatedBy,
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
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
