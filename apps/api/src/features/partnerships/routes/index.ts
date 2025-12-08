/**
 * Partnership Feature Routes
 * 特約商店體系 API 路由
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../../../middleware/validation'
import { PartnershipService } from '@makanmakan/database'
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
  partnershipIdParamSchema,
  planIdParamSchema,
  memberIdParamSchema,
} from '../schemas/validation'
import type { Env } from '../../../types/env'

const routes = new Hono<{ Bindings: Env }>()

// ================================================
// PARTNERSHIP MANAGEMENT (合作夥伴管理)
// ================================================

/**
 * 創建合作夥伴
 * POST /api/v1/partnerships
 * 需要管理員權限
 */
routes.post('/',
  authMiddleware,
  requireRole([0, 1]), // Admin or Shop Owner
  validateBody(createPartnershipSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const partnership = await service.createPartnership({
        ...data,
        createdBy: user.id,
      })

      return c.json({
        success: true,
        data: partnership,
      })
    } catch (error) {
      console.error('Create partnership error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create partnership',
      }, 500)
    }
  }
)

/**
 * 獲取合作夥伴列表
 * GET /api/v1/partnerships
 * 需要管理員權限
 */
routes.get('/',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(partnershipFiltersSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const { page, limit, ...restFilters } = filters
      const result = await service.listPartnerships(restFilters, page, limit)

      return c.json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error('List partnerships error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list partnerships',
      }, 500)
    }
  }
)

/**
 * 獲取合作夥伴詳情
 * GET /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.get('/:id',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(idParamSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const partnership = await service.getPartnership(id)

      if (!partnership) {
        return c.json({
          success: false,
          error: 'Partnership not found',
        }, 404)
      }

      return c.json({
        success: true,
        data: partnership,
      })
    } catch (error) {
      console.error('Get partnership error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get partnership',
      }, 500)
    }
  }
)

/**
 * 獲取合作夥伴統計
 * GET /api/v1/partnerships/:id/statistics
 * 需要管理員權限
 */
routes.get('/:id/statistics',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(idParamSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const stats = await service.getPartnershipStatistics(id)

      return c.json({
        success: true,
        data: stats,
      })
    } catch (error) {
      console.error('Get partnership statistics error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      }, 500)
    }
  }
)

/**
 * 更新合作夥伴
 * PUT /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.put('/:id',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(idParamSchema as any),
  validateBody(updatePartnershipSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const partnership = await service.updatePartnership(id, data)

      return c.json({
        success: true,
        data: partnership,
      })
    } catch (error) {
      console.error('Update partnership error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update partnership',
      }, 500)
    }
  }
)

/**
 * 刪除合作夥伴
 * DELETE /api/v1/partnerships/:id
 * 需要管理員權限
 */
routes.delete('/:id',
  authMiddleware,
  requireRole([0]), // Admin only
  validateParams(idParamSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      await service.deletePartnership(id)

      return c.json({
        success: true,
        message: 'Partnership deleted successfully',
      })
    } catch (error) {
      console.error('Delete partnership error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete partnership',
      }, 500)
    }
  }
)

// ================================================
// PLAN MANAGEMENT (方案管理)
// ================================================

/**
 * 創建特約方案
 * POST /api/v1/partnerships/plans
 * 需要管理員或店主權限
 */
routes.post('/plans',
  authMiddleware,
  requireRole([0, 1]),
  validateBody(createPlanSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const plan = await service.createPlan({
        ...data,
        createdBy: user.id,
      })

      return c.json({
        success: true,
        data: plan,
      })
    } catch (error) {
      console.error('Create plan error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create plan',
      }, 500)
    }
  }
)

/**
 * 獲取方案列表
 * GET /api/v1/partnerships/plans
 */
routes.get('/plans',
  authMiddleware,
  validateQuery(planFiltersSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const { page, limit, ...restFilters } = filters
      const result = await service.listPlans(restFilters, page, limit)

      return c.json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error('List plans error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list plans',
      }, 500)
    }
  }
)

/**
 * 獲取方案詳情
 * GET /api/v1/partnerships/plans/:planId
 */
routes.get('/plans/:planId',
  authMiddleware,
  validateParams(planIdParamSchema as any),
  async (c) => {
    try {
      const { planId } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const plan = await service.getPlan(planId)

      if (!plan) {
        return c.json({
          success: false,
          error: 'Plan not found',
        }, 404)
      }

      return c.json({
        success: true,
        data: plan,
      })
    } catch (error) {
      console.error('Get plan error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get plan',
      }, 500)
    }
  }
)

/**
 * 驗證方案並計算折扣
 * POST /api/v1/partnerships/plans/validate
 * 用於收銀員驗證特約優惠
 */
routes.post('/plans/validate',
  authMiddleware,
  validateBody(validatePlanSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const result = await service.validatePlan(
        data.planId,
        data.memberId,
        data.orderAmount,
        data.menuItems,
        data.categories
      )

      return c.json({
        success: true,
        data: result,
      })
    } catch (error) {
      console.error('Validate plan error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate plan',
      }, 500)
    }
  }
)

/**
 * 更新方案
 * PUT /api/v1/partnerships/plans/:planId
 * 需要管理員或店主權限
 */
routes.put('/plans/:planId',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(planIdParamSchema as any),
  validateBody(updatePlanSchema as any),
  async (c) => {
    try {
      const { planId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const plan = await service.updatePlan(planId, data)

      return c.json({
        success: true,
        data: plan,
      })
    } catch (error) {
      console.error('Update plan error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update plan',
      }, 500)
    }
  }
)

/**
 * 刪除方案
 * DELETE /api/v1/partnerships/plans/:planId
 * 需要管理員或店主權限
 */
routes.delete('/plans/:planId',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(planIdParamSchema as any),
  async (c) => {
    try {
      const { planId } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      await service.deletePlan(planId)

      return c.json({
        success: true,
        message: 'Plan deleted successfully',
      })
    } catch (error) {
      console.error('Delete plan error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete plan',
      }, 500)
    }
  }
)

// ================================================
// MEMBER MANAGEMENT (會員管理)
// ================================================

/**
 * 提交會員認證申請
 * POST /api/v1/partnerships/members/verify
 * 公開端點（學生/員工自助申請）
 */
routes.post('/members/verify',
  validateBody(memberVerificationSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const member = await service.submitMemberVerification(data)

      return c.json({
        success: true,
        data: member,
        message: 'Verification request submitted successfully',
      })
    } catch (error) {
      console.error('Submit verification error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit verification',
      }, 500)
    }
  }
)

/**
 * 獲取會員列表
 * GET /api/v1/partnerships/members
 * 需要管理員或店主權限
 */
routes.get('/members',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(memberFiltersSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const { page, limit, ...restFilters } = filters
      const result = await service.listMembers(restFilters, page, limit)

      return c.json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error('List members error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list members',
      }, 500)
    }
  }
)

/**
 * 獲取會員詳情
 * GET /api/v1/partnerships/members/:memberId
 * 需要管理員或店主權限
 */
routes.get('/members/:memberId',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(memberIdParamSchema as any),
  async (c) => {
    try {
      const { memberId } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const member = await service.getMember(memberId)

      if (!member) {
        return c.json({
          success: false,
          error: 'Member not found',
        }, 404)
      }

      return c.json({
        success: true,
        data: member,
      })
    } catch (error) {
      console.error('Get member error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get member',
      }, 500)
    }
  }
)

/**
 * 審核通過會員認證
 * POST /api/v1/partnerships/members/:memberId/approve
 * 需要管理員或店主權限
 */
routes.post('/members/:memberId/approve',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(memberIdParamSchema as any),
  validateBody(approveMemberSchema as any),
  async (c) => {
    try {
      const { memberId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const member = await service.approveMember(
        memberId,
        String(user.id),
        data.verificationExpiry
      )

      return c.json({
        success: true,
        data: member,
        message: 'Member approved successfully',
      })
    } catch (error) {
      console.error('Approve member error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve member',
      }, 500)
    }
  }
)

/**
 * 拒絕會員認證
 * POST /api/v1/partnerships/members/:memberId/reject
 * 需要管理員或店主權限
 */
routes.post('/members/:memberId/reject',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(memberIdParamSchema as any),
  validateBody(rejectMemberSchema as any),
  async (c) => {
    try {
      const { memberId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const member = await service.rejectMember(memberId, data.rejectionReason)

      return c.json({
        success: true,
        data: member,
        message: 'Member rejected',
      })
    } catch (error) {
      console.error('Reject member error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject member',
      }, 500)
    }
  }
)

/**
 * 更新會員資訊
 * PUT /api/v1/partnerships/members/:memberId
 * 需要管理員或店主權限
 */
routes.put('/members/:memberId',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(memberIdParamSchema as any),
  validateBody(updateMemberSchema as any),
  async (c) => {
    try {
      const { memberId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const member = await service.updateMember(memberId, data)

      return c.json({
        success: true,
        data: member,
      })
    } catch (error) {
      console.error('Update member error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update member',
      }, 500)
    }
  }
)

// ================================================
// USAGE LOGGING (使用記錄)
// ================================================

/**
 * 記錄特約優惠使用
 * POST /api/v1/partnerships/usage
 * 需要收銀員或以上權限
 */
routes.post('/usage',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Shop Owner, or Cashier
  validateBody(logUsageSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const usageLog = await service.logUsage({
        ...data,
        verifiedByUserId: user.id,
      })

      return c.json({
        success: true,
        data: usageLog,
        message: 'Usage logged successfully',
      })
    } catch (error) {
      console.error('Log usage error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log usage',
      }, 500)
    }
  }
)

/**
 * 獲取使用記錄列表
 * GET /api/v1/partnerships/usage
 * 需要管理員或店主權限
 */
routes.get('/usage',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(usageLogFiltersSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const { page, limit, ...restFilters } = filters
      const result = await service.listUsageLogs(restFilters, page, limit)

      return c.json({
        success: true,
        ...result,
      })
    } catch (error) {
      console.error('List usage logs error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list usage logs',
      }, 500)
    }
  }
)

/**
 * 取消使用記錄
 * POST /api/v1/partnerships/usage/:id/cancel
 * 需要管理員或店主權限
 */
routes.post('/usage/:id/cancel',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(idParamSchema as any),
  validateBody(cancelUsageSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const usageLog = await service.cancelUsageLog(id, data.reason)

      return c.json({
        success: true,
        data: usageLog,
        message: 'Usage cancelled successfully',
      })
    } catch (error) {
      console.error('Cancel usage error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel usage',
      }, 500)
    }
  }
)

/**
 * 退款使用記錄
 * POST /api/v1/partnerships/usage/:id/refund
 * 需要管理員或店主權限
 */
routes.post('/usage/:id/refund',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(idParamSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new PartnershipService(c.env.DB as any, c.env as any)

      const usageLog = await service.refundUsageLog(id)

      return c.json({
        success: true,
        data: usageLog,
        message: 'Usage refunded successfully',
      })
    } catch (error) {
      console.error('Refund usage error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund usage',
      }, 500)
    }
  }
)

export default routes
