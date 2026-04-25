/**
 * Partnership Feature Routes
 * 特約商店體系 API 路由
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { PartnershipService } from "@makanmakan/database";
import {
  createPartnershipSchema,
  updatePartnershipSchema,
  partnershipFiltersSchema,
  createPlanSchema,
  updatePlanSchema,
  planFiltersSchema,
  validatePlanSchema,
  memberVerificationSchema,
  approveMemberSchema,
  rejectMemberSchema,
  updateMemberSchema,
  memberFiltersSchema,
  logUsageSchema,
  usageLogFiltersSchema,
  cancelUsageSchema,
  idParamSchema,
  partnershipIdParamSchema as _partnershipIdParamSchema,
  planIdParamSchema,
  memberIdParamSchema,
} from "../schemas/validation";
import type { Env } from "../../../types/env";
import { notFound } from "../../../shared/utils/api-error";

const routes = new Hono<{ Bindings: Env }>();

// ================================================
// PARTNERSHIP MANAGEMENT (合作夥伴管理)
// ================================================

/**
 * 創建合作夥伴
 * POST /api/v1/partnerships
 * 需要管理員權限
 */
routes.post(
  "/",
  authMiddleware,
  requireRole([0, 1]), // Admin or Shop Owner
  moduleGate("loyalty"),
  validateBody(createPartnershipSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { contractStartDate, contractEndDate, ...rest } = data;
    const partnership = await service.createPartnership({
      ...rest,
      createdBy: user.id,
      contractStartDate: new Date(contractStartDate),
      contractEndDate: new Date(contractEndDate),
    });

    return c.json({
      success: true,
      data: partnership,
    });
  },
);

/**
 * 獲取合作夥伴列表
 * GET /api/v1/partnerships
 * 需要管理員權限
 */
routes.get(
  "/",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateQuery(partnershipFiltersSchema as any),
  async (c) => {
    const filters = c.get("validatedQuery");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { page, limit, ...restFilters } = filters;
    const result = await service.listPartnerships(restFilters, page, limit);

    return c.json({
      success: true,
      ...result,
    });
  },
);

/**
 * 獲取合作夥伴詳情
 * GET /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.get(
  "/:id",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const partnership = await service.getPartnership(id);

    if (!partnership) {
      throw notFound("Partnership not found");
    }

    return c.json({
      success: true,
      data: partnership,
    });
  },
);

/**
 * 獲取合作夥伴統計
 * GET /api/v1/partnerships/:id/statistics
 * 需要管理員權限
 */
routes.get(
  "/:id/statistics",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const stats = await service.getPartnershipStatistics(id);

    return c.json({
      success: true,
      data: stats,
    });
  },
);

/**
 * 更新合作夥伴
 * PUT /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.put(
  "/:id",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  validateBody(updatePartnershipSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { contractStartDate, contractEndDate, ...rest } = data;
    const partnership = await service.updatePartnership(id, {
      ...rest,
      ...(contractStartDate !== undefined && {
        contractStartDate: new Date(contractStartDate),
      }),
      ...(contractEndDate !== undefined && {
        contractEndDate: new Date(contractEndDate),
      }),
    });

    return c.json({
      success: true,
      data: partnership,
    });
  },
);

/**
 * 刪除合作夥伴
 * DELETE /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.delete(
  "/:id",
  authMiddleware,
  requireRole([0]), // Admin only
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    await service.deletePartnership(id);

    return c.json({
      success: true,
      message: "Partnership deleted successfully",
    });
  },
);

// ================================================
// PLAN MANAGEMENT (方案管理)
// ================================================

/**
 * 創建特約方案
 * POST /api/v1/partnerships/plans
 * 需要管理員或店主權限
 */
routes.post(
  "/plans",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateBody(createPlanSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { validFrom, validTo, ...rest } = data;
    const plan = await service.createPlan({
      ...rest,
      createdBy: user.id,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
    });

    return c.json({
      success: true,
      data: plan,
    });
  },
);

/**
 * 獲取方案列表
 * GET /api/v1/partnerships/plans
 */
routes.get(
  "/plans",
  authMiddleware,
  validateQuery(planFiltersSchema as any),
  async (c) => {
    const filters = c.get("validatedQuery");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { page, limit, ...restFilters } = filters;
    const result = await service.listPlans(restFilters, page, limit);

    return c.json({
      success: true,
      ...result,
    });
  },
);

/**
 * 獲取方案詳情
 * GET /api/v1/partnerships/plans/:planId
 */
routes.get(
  "/plans/:planId",
  authMiddleware,
  validateParams(planIdParamSchema as any),
  async (c) => {
    const { planId } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const plan = await service.getPlan(planId);

    if (!plan) {
      throw notFound("Plan not found");
    }

    return c.json({
      success: true,
      data: plan,
    });
  },
);

/**
 * 驗證方案並計算折扣
 * POST /api/v1/partnerships/plans/validate
 * 用於收銀員驗證特約優惠
 */
routes.post(
  "/plans/validate",
  authMiddleware,
  validateBody(validatePlanSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const result = await service.validatePlan(
      data.planId,
      data.memberId,
      data.orderAmount,
      data.menuItems,
      data.categories,
    );

    return c.json({
      success: true,
      data: result,
    });
  },
);

/**
 * 更新方案
 * PUT /api/v1/partnerships/plans/:planId
 * 需要管理員或店主權限
 */
routes.put(
  "/plans/:planId",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(planIdParamSchema as any),
  validateBody(updatePlanSchema),
  async (c) => {
    const { planId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { validFrom, validTo, ...rest } = data;
    const plan = await service.updatePlan(planId, {
      ...rest,
      ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
      ...(validTo !== undefined && { validTo: new Date(validTo) }),
    });

    return c.json({
      success: true,
      data: plan,
    });
  },
);

/**
 * 刪除方案
 * DELETE /api/v1/partnerships/plans/:planId
 * 需要管理員或店主權限
 */
routes.delete(
  "/plans/:planId",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(planIdParamSchema as any),
  async (c) => {
    const { planId } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    await service.deletePlan(planId);

    return c.json({
      success: true,
      message: "Plan deleted successfully",
    });
  },
);

// ================================================
// MEMBER MANAGEMENT (會員管理)
// ================================================

/**
 * 提交會員認證申請
 * POST /api/v1/partnerships/members/verify
 * 公開端點（學生/員工自助申請）
 */
routes.post(
  "/members/verify",
  validateBody(memberVerificationSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const member = await service.submitMemberVerification(data);

    return c.json({
      success: true,
      data: member,
      message: "Verification request submitted successfully",
    });
  },
);

/**
 * 獲取會員列表
 * GET /api/v1/partnerships/members
 * 需要管理員或店主權限
 */
routes.get(
  "/members",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateQuery(memberFiltersSchema as any),
  async (c) => {
    const filters = c.get("validatedQuery");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { page, limit, ...restFilters } = filters;
    const result = await service.listMembers(restFilters, page, limit);

    return c.json({
      success: true,
      ...result,
    });
  },
);

/**
 * 獲取會員詳情
 * GET /api/v1/partnerships/members/:memberId
 * 需要管理員或店主權限
 */
routes.get(
  "/members/:memberId",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(memberIdParamSchema as any),
  async (c) => {
    const { memberId } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const member = await service.getMember(memberId);

    if (!member) {
      throw notFound("Member not found");
    }

    return c.json({
      success: true,
      data: member,
    });
  },
);

/**
 * 審核通過會員認證
 * POST /api/v1/partnerships/members/:memberId/approve
 * 需要管理員或店主權限
 */
routes.post(
  "/members/:memberId/approve",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(memberIdParamSchema as any),
  validateBody(approveMemberSchema),
  async (c) => {
    const { memberId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const member = await service.approveMember(
      memberId,
      user.id,
      data.verificationExpiry == null
        ? undefined
        : new Date(data.verificationExpiry),
    );

    return c.json({
      success: true,
      data: member,
      message: "Member approved successfully",
    });
  },
);

/**
 * 拒絕會員認證
 * POST /api/v1/partnerships/members/:memberId/reject
 * 需要管理員或店主權限
 */
routes.post(
  "/members/:memberId/reject",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(memberIdParamSchema as any),
  validateBody(rejectMemberSchema),
  async (c) => {
    const { memberId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const member = await service.rejectMember(memberId, data.rejectionReason);

    return c.json({
      success: true,
      data: member,
      message: "Member rejected",
    });
  },
);

/**
 * 更新會員資訊
 * PUT /api/v1/partnerships/members/:memberId
 * 需要管理員或店主權限
 */
routes.put(
  "/members/:memberId",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(memberIdParamSchema as any),
  validateBody(updateMemberSchema),
  async (c) => {
    const { memberId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const member = await service.updateMember(memberId, data);

    return c.json({
      success: true,
      data: member,
    });
  },
);

// ================================================
// USAGE LOGGING (使用記錄)
// ================================================

/**
 * 記錄特約優惠使用
 * POST /api/v1/partnerships/usage
 * 需要收銀員或以上權限
 */
routes.post(
  "/usage",
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Shop Owner, or Cashier
  moduleGate("loyalty"),
  validateBody(logUsageSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    // Schema drift: logUsageSchema declares orderId as a UUID string, but the
    // partnership_usage_logs.order_id column references orders.id which is an
    // integer auto-increment PK. Removing the cast here would require fixing
    // the Zod schema (and any downstream consumers). Tracked separately.
    const usageLog = await service.logUsage({
      ...data,
      verifiedByUserId: user.id,
    } as unknown as Parameters<typeof service.logUsage>[0]);

    return c.json({
      success: true,
      data: usageLog,
      message: "Usage logged successfully",
    });
  },
);

/**
 * 獲取使用記錄列表
 * GET /api/v1/partnerships/usage
 * 需要管理員或店主權限
 */
routes.get(
  "/usage",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateQuery(usageLogFiltersSchema as any),
  async (c) => {
    const filters = c.get("validatedQuery");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const { page, limit, ...restFilters } = filters;
    const result = await service.listUsageLogs(restFilters, page, limit);

    return c.json({
      success: true,
      ...result,
    });
  },
);

/**
 * 取消使用記錄
 * POST /api/v1/partnerships/usage/:id/cancel
 * 需要管理員或店主權限
 */
routes.post(
  "/usage/:id/cancel",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  validateBody(cancelUsageSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const usageLog = await service.cancelUsageLog(id, data.reason);

    return c.json({
      success: true,
      data: usageLog,
      message: "Usage cancelled successfully",
    });
  },
);

/**
 * 退款使用記錄
 * POST /api/v1/partnerships/usage/:id/refund
 * 需要管理員或店主權限
 */
routes.post(
  "/usage/:id/refund",
  authMiddleware,
  requireRole([0, 1]),
  moduleGate("loyalty"),
  validateParams(idParamSchema as any),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new PartnershipService(c.env.DB as any, c.env as any);

    const usageLog = await service.refundUsageLog(id);

    return c.json({
      success: true,
      data: usageLog,
      message: "Usage refunded successfully",
    });
  },
);

export default routes;
