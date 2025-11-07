/**
 * Employee Scheduling Routes
 * All HTTP routes for employee work scheduling management
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole, requireRestaurantAccess } from '../../../shared/middleware'
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware'
import type { Env } from '../../../shared/types'
import { HTTP_STATUS, USER_ROLES } from '../../../shared/constants'
import { createSuccessResponse, createErrorResponse } from '../../../shared/utils'

// Import schemas
import { schedulingSchemas } from '../schemas/validation'

// Import service
import { SchedulingService } from '@makanmakan/database'

const app = new Hono<{ Bindings: Env }>()

// ========================================
// Shift Template Management
// ========================================

// GET /:restaurantId/templates - Get all shift templates
app.get('/:restaurantId/templates',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const service = new SchedulingService(c.env.DB, c.env)

      const templates = await service.getShiftTemplates(restaurantId)

      return c.json(createSuccessResponse(templates), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get shift templates error:', error)
      return c.json(
        createErrorResponse('Failed to fetch shift templates'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /templates/:id - Get a specific shift template
app.get('/templates/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.shiftTemplateIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new SchedulingService(c.env.DB, c.env)

      const template = await service.getShiftTemplate(id)

      if (!template) {
        return c.json(
          createErrorResponse('Shift template not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(createSuccessResponse(template), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get shift template error:', error)
      return c.json(
        createErrorResponse('Failed to fetch shift template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /:restaurantId/templates - Create a new shift template
app.post('/:restaurantId/templates',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateBody(schedulingSchemas.createShiftTemplate),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const template = await service.createShiftTemplate({
        ...data,
        restaurantId,
        createdBy: user.id,
      })

      return c.json(
        createSuccessResponse(template, 'Shift template created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Create shift template error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to create shift template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PUT /templates/:id - Update a shift template
app.put('/templates/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.shiftTemplateIdParam),
  validateBody(schedulingSchemas.updateShiftTemplate),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const template = await service.updateShiftTemplate(id, {
        ...data,
        updatedBy: user.id,
      })

      return c.json(
        createSuccessResponse(template, 'Shift template updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Update shift template error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update shift template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// DELETE /templates/:id - Delete a shift template
app.delete('/templates/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.shiftTemplateIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new SchedulingService(c.env.DB, c.env)

      const deleted = await service.deleteShiftTemplate(id)

      if (!deleted) {
        return c.json(
          createErrorResponse('Shift template not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(null, 'Shift template deleted successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Delete shift template error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to delete shift template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Employee Schedule Management
// ========================================

// GET /:restaurantId/schedules - Get employee schedules with filters
app.get('/:restaurantId/schedules',
  authMiddleware,
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.scheduleFilters),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const query = c.get('validatedQuery')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      // Employees can only view their own schedules
      const filters = {
        ...query,
        restaurantId,
        employeeId: user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER
          ? user.id
          : query.employeeId,
      }

      const result = await service.getSchedules(filters)

      return c.json({
        success: true,
        data: result.items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      }, HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get schedules error:', error)
      return c.json(
        createErrorResponse('Failed to fetch schedules'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /schedules/:id - Get a specific schedule
app.get('/schedules/:id',
  authMiddleware,
  validateParams(schedulingSchemas.scheduleIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const schedule = await service.getSchedule(id)

      if (!schedule) {
        return c.json(
          createErrorResponse('Schedule not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      // Check access
      if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
        if (schedule.employeeId !== user.id) {
          return c.json(
            createErrorResponse('Access denied'),
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      return c.json(createSuccessResponse(schedule), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get schedule error:', error)
      return c.json(
        createErrorResponse('Failed to fetch schedule'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /:restaurantId/schedules - Create a new schedule
app.post('/:restaurantId/schedules',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateBody(schedulingSchemas.createEmployeeSchedule),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const schedule = await service.createSchedule({
        ...data,
        restaurantId,
        createdBy: user.id,
      })

      return c.json(
        createSuccessResponse(schedule, 'Schedule created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Create schedule error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to create schedule'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /:restaurantId/schedules/bulk - Bulk create schedules
app.post('/:restaurantId/schedules/bulk',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateBody(schedulingSchemas.bulkCreateSchedules),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const count = await service.bulkCreateSchedules({
        ...data,
        restaurantId,
        createdBy: user.id,
      })

      return c.json(
        createSuccessResponse(
          { count },
          `Successfully created ${count} schedules`
        ),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Bulk create schedules error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to bulk create schedules'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PUT /schedules/:id - Update a schedule
app.put('/schedules/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.scheduleIdParam),
  validateBody(schedulingSchemas.updateEmployeeSchedule),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const schedule = await service.updateSchedule(id, {
        ...data,
        updatedBy: user.id,
      })

      return c.json(
        createSuccessResponse(schedule, 'Schedule updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Update schedule error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update schedule'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// DELETE /schedules/:id - Delete (cancel) a schedule
app.delete('/schedules/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.scheduleIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new SchedulingService(c.env.DB, c.env)

      const deleted = await service.deleteSchedule(id)

      if (!deleted) {
        return c.json(
          createErrorResponse('Schedule not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(null, 'Schedule cancelled successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Delete schedule error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to cancel schedule'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Clock In/Out
// ========================================

// POST /schedules/:id/clock-in - Clock in to a shift
app.post('/schedules/:id/clock-in',
  authMiddleware,
  validateParams(schedulingSchemas.scheduleIdParam),
  validateBody(schedulingSchemas.clockIn),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { employeeId, notes } = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      // Verify user is clocking in for themselves (unless admin)
      if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
        if (employeeId !== user.id) {
          return c.json(
            createErrorResponse('Access denied'),
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      const schedule = await service.clockIn({
        scheduleId: id,
        employeeId,
        clockInTime: new Date(),
        notes,
      })

      return c.json(
        createSuccessResponse(schedule, 'Clocked in successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Clock in error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to clock in'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /schedules/:id/clock-out - Clock out from a shift
app.post('/schedules/:id/clock-out',
  authMiddleware,
  validateParams(schedulingSchemas.scheduleIdParam),
  validateBody(schedulingSchemas.clockOut),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { employeeId, notes } = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      // Verify user is clocking out for themselves (unless admin)
      if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
        if (employeeId !== user.id) {
          return c.json(
            createErrorResponse('Access denied'),
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      const schedule = await service.clockOut({
        scheduleId: id,
        employeeId,
        clockOutTime: new Date(),
        notes,
      })

      return c.json(
        createSuccessResponse(schedule, 'Clocked out successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Clock out error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to clock out'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Swap Requests
// ========================================

// POST /:restaurantId/swap-requests - Create a swap request
app.post('/:restaurantId/swap-requests',
  authMiddleware,
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateBody(schedulingSchemas.createSwapRequest),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new SchedulingService(c.env.DB, c.env)

      const request = await service.createSwapRequest({
        ...data,
        restaurantId,
      })

      return c.json(
        createSuccessResponse(request, 'Swap request created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Create swap request error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to create swap request'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/swap-requests - Get swap requests with filters
app.get('/:restaurantId/swap-requests',
  authMiddleware,
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.swapRequestFilters),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const filters = c.get('validatedQuery')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      // Employees can only view their own swap requests
      const swapFilters = {
        ...filters,
        restaurantId,
        requesterEmployeeId: user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER
          ? user.id
          : filters.requesterEmployeeId,
      }

      const result = await service.getSwapRequests(swapFilters)

      return c.json({
        success: true,
        data: result.items,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      }, HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get swap requests error:', error)
      return c.json(
        createErrorResponse('Failed to fetch swap requests'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /swap-requests/:id/accept - Accept a swap request (employee)
app.post('/swap-requests/:id/accept',
  authMiddleware,
  validateParams(schedulingSchemas.swapRequestIdParam),
  validateBody(schedulingSchemas.acceptSwapRequest),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { employeeId } = c.get('validatedBody')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      // Verify user is accepting for themselves (unless admin)
      if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
        if (employeeId !== user.id) {
          return c.json(
            createErrorResponse('Access denied'),
            HTTP_STATUS.FORBIDDEN
          )
        }
      }

      const request = await service.acceptSwapRequest(id, employeeId)

      return c.json(
        createSuccessResponse(request, 'Swap request accepted successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Accept swap request error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to accept swap request'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /swap-requests/:id/approve - Approve a swap request (manager)
app.post('/swap-requests/:id/approve',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.swapRequestIdParam),
  validateBody(schedulingSchemas.approveSwapRequest),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { managerId } = c.get('validatedBody')
      const service = new SchedulingService(c.env.DB, c.env)

      const request = await service.approveSwapRequest(id, managerId)

      return c.json(
        createSuccessResponse(request, 'Swap request approved successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Approve swap request error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to approve swap request'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /swap-requests/:id/reject - Reject a swap request (manager)
app.post('/swap-requests/:id/reject',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.swapRequestIdParam),
  validateBody(schedulingSchemas.rejectSwapRequest),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { managerId, reason } = c.get('validatedBody')
      const service = new SchedulingService(c.env.DB, c.env)

      const request = await service.rejectSwapRequest(id, managerId, reason)

      return c.json(
        createSuccessResponse(request, 'Swap request rejected successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Reject swap request error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to reject swap request'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /swap-requests/:id/cancel - Cancel a swap request (requester)
app.post('/swap-requests/:id/cancel',
  authMiddleware,
  validateParams(schedulingSchemas.swapRequestIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const service = new SchedulingService(c.env.DB, c.env)

      const request = await service.cancelSwapRequest(id, user.id)

      return c.json(
        createSuccessResponse(request, 'Swap request cancelled successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Cancel swap request error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to cancel swap request'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Available Employees (Leave Integration)
// ========================================

// GET /:restaurantId/available-employees - Get available employees for scheduling
// Filters out employees on approved leave and already scheduled
app.get('/:restaurantId/available-employees',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.availableEmployeesQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { date, shiftTemplateId } = c.get('validatedQuery')
      const service = new SchedulingService(c.env.DB, c.env)

      const availableEmployees = await service.getAvailableEmployees({
        restaurantId,
        date,
        shiftTemplateId,
      })

      return c.json(
        createSuccessResponse(
          availableEmployees,
          `Found ${availableEmployees.length} available employees for ${date}`
        ),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Get available employees error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to fetch available employees'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Conflict Management
// ========================================

// GET /:restaurantId/conflicts - Get scheduling conflicts
app.get('/:restaurantId/conflicts',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.conflictFilters),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const filters = c.get('validatedQuery')
      const service = new SchedulingService(c.env.DB, c.env)

      const result = await service.getConflicts({
        ...filters,
        restaurantId,
      })

      return c.json({
        success: true,
        data: result.items,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      }, HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get conflicts error:', error)
      return c.json(
        createErrorResponse('Failed to fetch conflicts'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /conflicts/:id - Get a specific conflict
app.get('/conflicts/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.conflictIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new SchedulingService(c.env.DB, c.env)

      const conflict = await service.getConflict(id)

      if (!conflict) {
        return c.json(
          createErrorResponse('Conflict not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(createSuccessResponse(conflict), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get conflict error:', error)
      return c.json(
        createErrorResponse('Failed to fetch conflict'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /conflicts/:id/resolve - Resolve a conflict
app.post('/conflicts/:id/resolve',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(schedulingSchemas.conflictIdParam),
  validateBody(schedulingSchemas.resolveConflict),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { userId, resolutionNotes } = c.get('validatedBody')
      const service = new SchedulingService(c.env.DB, c.env)

      const conflict = await service.resolveConflict(id, userId, resolutionNotes)

      return c.json(
        createSuccessResponse(conflict, 'Conflict resolved successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Resolve conflict error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to resolve conflict'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ========================================
// Statistics & Analytics
// ========================================

// GET /:restaurantId/stats/daily - Get daily scheduling statistics
app.get('/:restaurantId/stats/daily',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.statsQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { date } = c.get('validatedQuery')
      const service = new SchedulingService(c.env.DB, c.env)

      const stats = await service.getDailyStats(restaurantId, date)

      return c.json(
        createSuccessResponse(stats, 'Daily statistics retrieved successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Get daily stats error:', error)
      return c.json(
        createErrorResponse('Failed to fetch daily statistics'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/stats/weekly - Get weekly schedule summary
app.get('/:restaurantId/stats/weekly',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(schedulingSchemas.restaurantIdParam),
  validateQuery(schedulingSchemas.weeklySummaryQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { weekStartDate } = c.get('validatedQuery')
      const service = new SchedulingService(c.env.DB, c.env)

      const summary = await service.getWeeklySummary(restaurantId, weekStartDate)

      return c.json(
        createSuccessResponse(summary, 'Weekly summary retrieved successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Get weekly summary error:', error)
      return c.json(
        createErrorResponse('Failed to fetch weekly summary'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

export default app
