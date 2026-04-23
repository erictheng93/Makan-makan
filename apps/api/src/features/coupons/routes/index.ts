/**
 * Coupons Feature Routes
 *
 * Modular route handlers for coupon management
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { CouponsService } from "../services/CouponsService";
import {
  validateCouponSchema,
  createCouponSchema,
  updateCouponSchema,
  couponFiltersSchema,
  idParamSchema,
  restaurantIdParamSchema,
  bulkActionSchema,
  useCouponSchema,
} from "../schemas/validation";
import type { Env } from "../../../types/env";
import {
  notFound,
  forbidden,
  badRequest,
  conflict,
} from "../../../shared/utils/api-error";

const routes = new Hono<{ Bindings: Env }>();

/**
 * 驗證優惠券代碼
 * POST /api/v1/coupons/validate
 * 公開端點，用於前端驗證優惠券
 */
routes.post("/validate", validateBody(validateCouponSchema), async (c) => {
  const data = c.get("validatedBody");
  const couponsService = new CouponsService(c.env.DB as any, c.env);

  const result = await couponsService.validateCouponWithBusinessRules(
    data.code,
    data.restaurantId,
    data.orderAmount,
    data.userId,
    data.menuItems,
  );

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * 獲取可用優惠券列表 (供客戶使用)
 * GET /api/v1/coupons/available/:restaurantId
 */
routes.get(
  "/available/:restaurantId",
  validateParams(restaurantIdParamSchema as any),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    const availableCoupons =
      await couponsService.getAvailableCoupons(restaurantId);

    return c.json({
      success: true,
      data: availableCoupons,
    });
  },
);

/**
 * 創建優惠券 (管理員和店主)
 * POST /api/v1/coupons
 */
routes.post(
  "/",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateBody(createCouponSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 權限檢查：店主只能為自己的餐廳創建優惠券
    if (user.role === 1) {
      data.restaurantId = user.restaurantId;
    }

    // 設置創建者
    data.createdBy = user.id;

    const coupon = await couponsService.createCouponWithValidation(data);

    return c.json(
      {
        success: true,
        data: coupon,
      },
      201,
    );
  },
);

/**
 * 獲取優惠券列表 (管理功能)
 * GET /api/v1/coupons
 */
routes.get(
  "/",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateQuery(couponFiltersSchema as any),
  async (c) => {
    const query = c.get("validatedQuery");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    const filters: any = { ...query };

    // 權限過濾：店主只能查看自己餐廳的優惠券
    if (user.role === 1) {
      filters.restaurantId = user.restaurantId;
    }

    const result = await couponsService.getCouponsWithEnhancedFilters(
      filters,
      query.page,
      query.limit,
    );

    return c.json({
      success: true,
      data: result.coupons,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  },
);

/**
 * 獲取優惠券彙總統計
 * GET /api/v1/coupons/stats/summary
 */
routes.get(
  "/stats/summary",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]),
  async (c) => {
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    const restaurantId = user.role === 1 ? user.restaurantId : undefined;
    const stats = await couponsService.getCouponSummaryStats(restaurantId);

    return c.json({
      success: true,
      data: stats,
    });
  },
);

/**
 * 獲取單個優惠券詳情
 * GET /api/v1/coupons/:id
 */
routes.get(
  "/:id",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    const coupon = await couponsService.getCoupon(id);

    if (!coupon) {
      throw notFound("Coupon not found");
    }

    // 權限檢查：店主只能查看自己餐廳的優惠券
    if (user.role === 1 && coupon.restaurantId !== user.restaurantId) {
      throw forbidden("Access denied");
    }

    return c.json({
      success: true,
      data: coupon,
    });
  },
);

/**
 * 更新優惠券
 * PUT /api/v1/coupons/:id
 */
routes.put(
  "/:id",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateParams(idParamSchema as any),
  validateBody(updateCouponSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 獲取現有優惠券
    const existingCoupon = await couponsService.getCoupon(id);

    if (!existingCoupon) {
      throw notFound("Coupon not found");
    }

    // 權限檢查：店主只能更新自己餐廳的優惠券
    if (user.role === 1 && existingCoupon.restaurantId !== user.restaurantId) {
      throw forbidden("Access denied");
    }

    const updatedCoupon = await couponsService.updateCoupon(id, data);

    return c.json({
      success: true,
      data: updatedCoupon,
    });
  },
);

/**
 * 停用優惠券
 * POST /api/v1/coupons/:id/deactivate
 */
routes.post(
  "/:id/deactivate",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 獲取現有優惠券
    const existingCoupon = await couponsService.getCoupon(id);

    if (!existingCoupon) {
      throw notFound("Coupon not found");
    }

    // 權限檢查：店主只能停用自己餐廳的優惠券
    if (user.role === 1 && existingCoupon.restaurantId !== user.restaurantId) {
      throw forbidden("Access denied");
    }

    const deactivatedCoupon = await couponsService.deactivateCoupon(id);

    return c.json({
      success: true,
      data: deactivatedCoupon,
      message: "Coupon deactivated successfully",
    });
  },
);

/**
 * 刪除優惠券
 * DELETE /api/v1/coupons/:id
 */
routes.delete(
  "/:id",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0]), // 僅管理員
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 檢查優惠券是否存在
    const existingCoupon = await couponsService.getCoupon(id);

    if (!existingCoupon) {
      throw notFound("Coupon not found");
    }

    await couponsService.deleteCoupon(id);

    return c.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  },
);

/**
 * 獲取優惠券使用統計
 * GET /api/v1/coupons/:id/stats
 */
routes.get(
  "/:id/stats",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 獲取優惠券資訊
    const coupon = await couponsService.getCoupon(id);

    if (!coupon) {
      throw notFound("Coupon not found");
    }

    // 權限檢查：店主只能查看自己餐廳的優惠券統計
    if (user.role === 1 && coupon.restaurantId !== user.restaurantId) {
      throw forbidden("Access denied");
    }

    const stats = await couponsService.getComprehensiveCouponStats(id);

    return c.json({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
        stats,
      },
    });
  },
);

/**
 * 批量操作優惠券
 * POST /api/v1/coupons/bulk
 */
routes.post(
  "/bulk",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  validateBody(bulkActionSchema),
  async (c) => {
    const { couponIds, action } = c.get("validatedBody");
    const user = c.get("user");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 權限檢查：店主只能操作自己餐廳的優惠券
    if (user.role === 1) {
      // Check if all coupons belong to the user's restaurant
      for (const id of couponIds) {
        const coupon = await couponsService.getCoupon(id);
        if (!coupon || coupon.restaurantId !== user.restaurantId) {
          throw forbidden("Access denied for one or more coupons");
        }
      }
    }

    let result: { success: number; failed: number };

    switch (action) {
      case "activate":
        result = await couponsService.bulkActivateCoupons(couponIds);
        break;
      case "deactivate":
        result = await couponsService.bulkDeactivateCoupons(couponIds);
        break;
      case "delete":
        if (user.role !== 0) {
          throw forbidden("Only administrators can delete coupons");
        }
        result = await couponsService.bulkDeleteCoupons(couponIds);
        break;
      default:
        throw badRequest("Invalid action");
    }

    return c.json({
      success: true,
      data: result,
      message: `Bulk ${action} completed. Success: ${result.success}, Failed: ${result.failed}`,
    });
  },
);

/**
 * 記錄優惠券使用 (內部 API)
 * POST /api/v1/coupons/use
 */
routes.post(
  "/use",
  authMiddleware,
  moduleGate("coupons"),
  validateBody(useCouponSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    let usageRecord;
    try {
      usageRecord = await couponsService.useCoupon(data);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Coupon usage limit reached")
      ) {
        throw conflict(
          "Coupon usage limit reached",
          "COUPON_USAGE_LIMIT_REACHED",
        );
      }
      throw error;
    }

    return c.json({
      success: true,
      data: usageRecord,
    });
  },
);

/**
 * 獲取優惠券使用趨勢
 * GET /api/v1/coupons/analytics/trends
 */
routes.get(
  "/analytics/trends",
  authMiddleware,
  moduleGate("coupons"),
  requireRole([0, 1]), // 管理員和店主
  async (c) => {
    const user = c.get("user");
    const { restaurantId, startDate, endDate } = c.req.query();
    const couponsService = new CouponsService(c.env.DB as any, c.env);

    // 權限檢查：店主只能查看自己餐廳的數據
    const queryRestaurantId =
      user.role === 1 ? user.restaurantId?.toString() : restaurantId;

    const trends = await couponsService.getCouponUsageTrends(
      queryRestaurantId,
      startDate,
      endDate,
    );

    return c.json({
      success: true,
      data: trends,
    });
  },
);

export default routes;
