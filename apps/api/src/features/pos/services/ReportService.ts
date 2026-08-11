/**
 * 報表統計服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, type SQL } from "drizzle-orm";
import {
  cashShifts,
  cashRegisters,
  cashMovements,
  receipts,
  orders,
  refunds,
  orderItems,
  menuItems,
  shiftReports,
  amountFromCents,
  avgAbsMoneyAmount,
  avgMoneyAmount,
  dateFromUnixMs,
  strftimeFromUnixMs,
  sumMoneyAmount,
} from "@makanmasak/database";
import { generateUUID } from "@makanmasak/utils";

export class ReportService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 生成班次報表
   */
  async generateShiftReport(shiftId: string): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      // 獲取班次基本資訊
      const [shift] = await this.db
        .select()
        .from(cashShifts)
        .where(eq(cashShifts.id, shiftId))
        .limit(1);

      if (!shift) {
        return {
          success: false,
          error: "班次不存在",
        };
      }

      // 獲取現金流動記錄
      const movements = await this.db
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.shiftId, shiftId))
        .orderBy(cashMovements.createdAt);

      // 獲取收據記錄
      const [receiptStats] = await this.db
        .select({
          totalReceipts: sql<number>`COUNT(*)`,
          printedReceipts: sql<number>`COUNT(CASE WHEN ${receipts.printStatus} = 'printed' THEN 1 END)`,
        })
        .from(receipts)
        .where(eq(receipts.shiftId, shiftId));

      // 獲取訂單統計
      const startedAt = shift.startedAt;
      const endedAt = shift.endedAt || new Date();
      const startAmount = amountFromCents(shift.startAmountCents) ?? 0;
      const endAmount = amountFromCents(shift.endAmountCents) ?? 0;
      const expectedAmount = amountFromCents(shift.expectedAmountCents) ?? 0;
      const actualAmount = amountFromCents(shift.actualAmountCents) ?? 0;
      const differenceAmount =
        amountFromCents(shift.differenceAmountCents) ?? 0;
      const totalRefunds = amountFromCents(shift.totalRefundsCents) ?? 0;
      const cashSales = amountFromCents(shift.cashSalesCents) ?? 0;
      const cardSales = amountFromCents(shift.cardSalesCents) ?? 0;
      const digitalSales = amountFromCents(shift.digitalSalesCents) ?? 0;

      const [orderStats] = await this.db
        .select({
          totalOrders: sql<number>`COUNT(*)`,
          totalSales: sumMoneyAmount(orders.totalAmountCents),
          avgOrderValue: avgMoneyAmount(orders.totalAmountCents),
          cashOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'cash' THEN 1 END)`,
          cardOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'card' THEN 1 END)`,
          digitalOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'digital_wallet' THEN 1 END)`,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.createdAt} >= ${startedAt}`,
            sql`${orders.createdAt} <= ${endedAt}`,
          ),
        );

      // 生成報表數據
      const reportData = {
        shift: {
          ...shift,
          duration: shift.endedAt
            ? Math.floor(
                (new Date(shift.endedAt).getTime() -
                  new Date(shift.startedAt).getTime()) /
                  60000,
              )
            : null,
        },
        summary: {
          startAmount,
          endAmount,
          totalSales: orderStats?.totalSales || 0,
          totalRefunds,
          netSales: (orderStats?.totalSales || 0) - totalRefunds,
          expectedAmount,
          actualAmount,
          difference: differenceAmount,
        },
        breakdown: {
          cashSales,
          cardSales,
          digitalSales,
        },
        orderStats: {
          totalOrders: orderStats?.totalOrders || 0,
          avgOrderValue: orderStats?.avgOrderValue || 0,
          cashOrders: orderStats?.cashOrders || 0,
          cardOrders: orderStats?.cardOrders || 0,
          digitalOrders: orderStats?.digitalOrders || 0,
        },
        movements: movements.map(
          (movement: typeof cashMovements.$inferSelect) => ({
            ...movement,
            amount: amountFromCents(movement.amountCents) ?? 0,
            denominationBreakdown: JSON.parse(
              (movement.denominationBreakdown as string) || "{}",
            ),
            metadata: JSON.parse((movement.metadata as string) || "{}"),
          }),
        ),
        receipts: receiptStats || {
          totalReceipts: 0,
          printedReceipts: 0,
        },
      };

      // 保存報表
      const reportId = generateUUID();
      const generatedAt = new Date();
      await this.db.insert(shiftReports).values({
        id: reportId,
        shiftId,
        registerId: shift.registerId,
        operatorId: shift.operatorId,
        reportData: JSON.stringify(reportData),
        summaryData: JSON.stringify(reportData.summary),
        generatedAt,
      });

      return {
        success: true,
        data: {
          reportId,
          reportData,
        },
      };
    } catch (error) {
      console.error("生成班次報表失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成班次報表失敗",
      };
    }
  }

  /**
   * 獲取班次統計
   */
  async getShiftStats(
    restaurantId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const conditions: SQL[] = [eq(cashRegisters.restaurantId, restaurantId)];

      if (dateRange) {
        conditions.push(
          sql`${cashShifts.startedAt} >= ${dateRange.from.toISOString()}`,
        );
        conditions.push(
          sql`${cashShifts.startedAt} <= ${dateRange.to.toISOString()}`,
        );
      }

      const [stats] = await this.db
        .select({
          totalShifts: sql<number>`COUNT(*)`,
          totalSales: sumMoneyAmount(cashShifts.totalSalesCents),
          totalRefunds: sumMoneyAmount(cashShifts.totalRefundsCents),
          avgSalesPerShift: avgMoneyAmount(cashShifts.totalSalesCents),
          totalCashSales: sumMoneyAmount(cashShifts.cashSalesCents),
          totalCardSales: sumMoneyAmount(cashShifts.cardSalesCents),
          totalDigitalSales: sumMoneyAmount(cashShifts.digitalSalesCents),
          closedShifts: sql<number>`COUNT(CASE WHEN ${cashShifts.status} = 'closed' THEN 1 END)`,
          avgCashDifference: avgAbsMoneyAmount(
            cashShifts.differenceAmountCents,
          ),
        })
        .from(cashShifts)
        .innerJoin(cashRegisters, eq(cashShifts.registerId, cashRegisters.id))
        .where(and(...conditions));

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("獲取班次統計失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取班次統計失敗",
      };
    }
  }

  /**
   * 獲取日營業報表
   */
  async getDailyReport(
    restaurantId: string,
    date: string,
  ): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      // 獲取當日班次
      const shifts = await this.db
        .select()
        .from(cashShifts)
        .innerJoin(cashRegisters, eq(cashShifts.registerId, cashRegisters.id))
        .where(
          and(
            eq(cashRegisters.restaurantId, restaurantId),
            sql`${dateFromUnixMs(cashShifts.startedAt)} = ${date}`,
          ),
        )
        .orderBy(cashShifts.startedAt);

      // 獲取當日訂單統計
      const [orderStats] = await this.db
        .select({
          totalOrders: sql<number>`COUNT(*)`,
          totalSales: sumMoneyAmount(orders.totalAmountCents),
          totalTax: sumMoneyAmount(orders.taxAmountCents),
          totalDiscounts: sumMoneyAmount(orders.discountAmountCents),
          avgOrderValue: avgMoneyAmount(orders.totalAmountCents),
          cashOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'cash' THEN 1 END)`,
          cardOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'card' THEN 1 END)`,
          digitalOrders: sql<number>`COUNT(CASE WHEN ${orders.paymentMethod} = 'digital_wallet' THEN 1 END)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            sql`${dateFromUnixMs(orders.createdAt)} = ${date}`,
          ),
        );

      // 獲取退款統計
      const [refundStats] = await this.db
        .select({
          totalRefunds: sql<number>`COUNT(*)`,
          totalRefundAmount: sumMoneyAmount(refunds.refundAmountCents),
        })
        .from(refunds)
        .innerJoin(cashRegisters, eq(refunds.registerId, cashRegisters.id))
        .where(
          and(
            eq(cashRegisters.restaurantId, restaurantId),
            sql`${dateFromUnixMs(refunds.processedAt)} = ${date}`,
            eq(refunds.status, "completed"),
          ),
        );

      // 獲取熱門商品
      const topItems = await this.db
        .select({
          name: menuItems.name,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
          totalRevenue: sumMoneyAmount(orderItems.totalPriceCents),
        })
        .from(orderItems)
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            sql`${dateFromUnixMs(orders.createdAt)} = ${date}`,
          ),
        )
        .groupBy(menuItems.id, menuItems.name)
        .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
        .limit(10);

      const reportData = {
        date,
        shifts: shifts.map((s) => s.cash_shifts),
        summary: {
          totalOrders: orderStats?.totalOrders || 0,
          totalSales: orderStats?.totalSales || 0,
          totalTax: orderStats?.totalTax || 0,
          totalDiscounts: orderStats?.totalDiscounts || 0,
          totalRefunds: refundStats?.totalRefunds || 0,
          totalRefundAmount: refundStats?.totalRefundAmount || 0,
          avgOrderValue: orderStats?.avgOrderValue || 0,
          netSales:
            (orderStats?.totalSales || 0) -
            (refundStats?.totalRefundAmount || 0),
        },
        paymentBreakdown: {
          cashOrders: orderStats?.cashOrders || 0,
          cardOrders: orderStats?.cardOrders || 0,
          digitalOrders: orderStats?.digitalOrders || 0,
        },
        topItems,
      };

      return {
        success: true,
        data: reportData,
      };
    } catch (error) {
      console.error("獲取日營業報表失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取日營業報表失敗",
      };
    }
  }

  /**
   * 獲取收銀機使用統計
   */
  async getRegisterUsageStats(
    restaurantId: string,
    period: "day" | "week" | "month" = "day",
  ): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      let dateFilter: SQL;
      let groupByExpr: SQL;

      switch (period) {
        case "day":
          dateFilter = sql`${cashShifts.startedAt} >= (unixepoch('now', '-7 days') * 1000)`;
          groupByExpr = dateFromUnixMs(cashShifts.startedAt);
          break;
        case "week":
          dateFilter = sql`${cashShifts.startedAt} >= (unixepoch('now', '-4 weeks') * 1000)`;
          groupByExpr = strftimeFromUnixMs("%Y-%W", cashShifts.startedAt);
          break;
        case "month":
          dateFilter = sql`${cashShifts.startedAt} >= (unixepoch('now', '-12 months') * 1000)`;
          groupByExpr = strftimeFromUnixMs("%Y-%m", cashShifts.startedAt);
          break;
      }

      const stats = await this.db
        .select({
          registerName: cashRegisters.name,
          period: groupByExpr,
          shiftCount: sql<number>`COUNT(${cashShifts.id})`,
          totalSales: sumMoneyAmount(cashShifts.totalSalesCents),
          totalTransactions: sql<number>`SUM(${cashShifts.totalTransactions})`,
          avgSalesPerShift: avgMoneyAmount(cashShifts.totalSalesCents),
        })
        .from(cashRegisters)
        .leftJoin(
          cashShifts,
          and(eq(cashRegisters.id, cashShifts.registerId), dateFilter),
        )
        .where(eq(cashRegisters.restaurantId, restaurantId))
        .groupBy(cashRegisters.id, groupByExpr)
        .orderBy(sql`${groupByExpr} DESC`, cashRegisters.name);

      return {
        success: true,
        data: {
          period,
          stats,
        },
      };
    } catch (error) {
      console.error("獲取收銀機使用統計失敗:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "獲取收銀機使用統計失敗",
      };
    }
  }
}
