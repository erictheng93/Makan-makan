/**
 * Leave Management Routes
 * All HTTP routes for employee leave/time-off management
 */

import { Hono } from "hono";
import {
  authMiddleware,
  requireRole,
  requireRestaurantAccess,
} from "../../../shared/middleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS, USER_ROLES } from "../../../shared/constants";
import { createSuccessResponse } from "../../../shared/utils";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";

// Import schemas
import { leaveSchemas, calculateLeaveDays } from "../schemas/validation";

// Import service
import { LeaveService } from "@makanmakan/database";

const app = new Hono<{ Bindings: Env }>();

// ========================================
// Leave Types Management
// ========================================

// GET /:restaurantId/types - Get all leave types
app.get(
  "/:restaurantId/types",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const service = new LeaveService(c.env.DB, c.env);

    const types = await service.getLeaveTypes(restaurantId);

    return c.json(createSuccessResponse(types), HTTP_STATUS.OK);
  },
);

// GET /types/:id - Get a specific leave type
app.get(
  "/types/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveTypeIdParam),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new LeaveService(c.env.DB, c.env);

    const type = await service.getLeaveType(id);

    if (!type) {
      throw notFound("Leave type not found");
    }

    return c.json(createSuccessResponse(type), HTTP_STATUS.OK);
  },
);

// POST /:restaurantId/types - Create a new leave type
app.post(
  "/:restaurantId/types",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  validateBody(leaveSchemas.createLeaveType),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    const type = await service.createLeaveType({
      ...data,
      restaurantId,
      // createdBy is intentionally added at the route layer for audit trail; the
      // DB-package CreateLeaveTypeData type omits it, so widen via cast.
      createdBy: user.id,
    } as unknown as Parameters<typeof service.createLeaveType>[0]);

    return c.json(
      createSuccessResponse(type, "Leave type created successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// PUT /types/:id - Update a leave type
app.put(
  "/types/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveTypeIdParam),
  validateBody(leaveSchemas.updateLeaveType),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    const type = await service.updateLeaveType(id, {
      ...data,
      updatedBy: user.id,
    });

    return c.json(
      createSuccessResponse(type, "Leave type updated successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// DELETE /types/:id - Delete a leave type
app.delete(
  "/types/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveTypeIdParam),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new LeaveService(c.env.DB, c.env);

    const deleted = await service.deleteLeaveType(id);

    if (!deleted) {
      throw notFound("Leave type not found or cannot be deleted");
    }

    return c.json(
      createSuccessResponse(null, "Leave type deleted successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// ========================================
// Leave Balance Management
// ========================================

// GET /balances - Get employee leave balances
app.get(
  "/balances",
  authMiddleware,
  validateQuery(leaveSchemas.leaveBalanceQuery),
  async (c) => {
    const query = c.get("validatedQuery");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    // Check access: employees can only view their own balances
    if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
      if (query.employeeId !== user.id) {
        throw forbidden("Access denied");
      }
    }

    const year = query.year || new Date().getFullYear();
    const balances = await service.getEmployeeLeaveBalances(
      query.employeeId,
      year,
    );

    return c.json(createSuccessResponse(balances), HTTP_STATUS.OK);
  },
);

// POST /balances/adjust - Manually adjust leave balance
app.post(
  "/balances/adjust",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateBody(leaveSchemas.adjustLeaveBalance),
  async (c) => {
    const data = c.get("validatedBody");
    const service = new LeaveService(c.env.DB, c.env);

    const balance = await service.adjustLeaveBalance(data);

    return c.json(
      createSuccessResponse(balance, "Leave balance adjusted successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// GET /:restaurantId/balances - Get all leave balances for a restaurant (bulk)
app.get(
  "/:restaurantId/balances",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const url = new URL(c.req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    const service = new LeaveService(c.env.DB, c.env);

    const balances = await service.getRestaurantLeaveBalances(
      restaurantId,
      year,
    );

    return c.json(createSuccessResponse(balances), HTTP_STATUS.OK);
  },
);

// POST /:restaurantId/balances/accrue - Accrue leave balances for all employees
app.post(
  "/:restaurantId/balances/accrue",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  validateBody(leaveSchemas.accrueLeaveBalances),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { year } = c.get("validatedBody");
    const service = new LeaveService(c.env.DB, c.env);

    const count = await service.accrueLeaveBalances(restaurantId, year);

    return c.json(
      createSuccessResponse(
        { count },
        `Successfully accrued leave balances for ${count} employee-leave type combinations`,
      ),
      HTTP_STATUS.OK,
    );
  },
);

// ========================================
// Leave Request Management
// ========================================

// GET /:restaurantId/requests - Get leave requests with filters
app.get(
  "/:restaurantId/requests",
  authMiddleware,
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  validateQuery(leaveSchemas.leaveRequestFilters),
  async (c) => {
    const query = c.get("validatedQuery");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    // Employees can only view their own requests
    const filters = {
      ...query,
      employeeId:
        user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER
          ? user.id
          : query.employeeId,
    };

    const result = await service.getLeaveRequests(filters);

    return c.json(
      {
        success: true,
        data: result.items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      },
      HTTP_STATUS.OK,
    );
  },
);

// GET /requests/:id - Get a specific leave request
app.get(
  "/requests/:id",
  authMiddleware,
  validateParams(leaveSchemas.leaveRequestIdParam),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    const request = await service.getLeaveRequest(id);

    if (!request) {
      throw notFound("Leave request not found");
    }

    // Check access
    if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
      if (request.employeeId !== user.id) {
        throw forbidden("Access denied");
      }
    }

    return c.json(createSuccessResponse(request), HTTP_STATUS.OK);
  },
);

// POST /:restaurantId/requests - Create a new leave request
app.post(
  "/:restaurantId/requests",
  authMiddleware,
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  validateBody(leaveSchemas.createLeaveRequest),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new LeaveService(c.env.DB, c.env);

    // Calculate total days
    const totalDays = calculateLeaveDays(
      data.startDate,
      data.endDate,
      data.startPeriod,
      data.endPeriod,
    );

    if (data.employeeId == null) {
      throw badRequest("employeeId is required");
    }
    const employeeId = data.employeeId;

    // Check if employee has sufficient balance
    const balance = await service.getLeaveBalance(
      employeeId,
      data.leaveTypeId,
      new Date().getFullYear(),
    );

    if (balance && balance.remainingDays < totalDays) {
      throw badRequest(
        `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${totalDays} days`,
      );
    }

    const request = await service.createLeaveRequest({
      ...data,
      employeeId,
      restaurantId,
      totalDays,
    } as Parameters<typeof service.createLeaveRequest>[0]);

    return c.json(
      createSuccessResponse(request, "Leave request created successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// POST /requests/:id/approve - Approve a leave request
app.post(
  "/requests/:id/approve",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveRequestIdParam),
  validateBody(leaveSchemas.approveLeaveRequest),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { approverId, comments } = c.get("validatedBody");
    const service = new LeaveService(c.env.DB, c.env);

    const request = await service.approveLeaveRequest(id, approverId, comments);

    return c.json(
      createSuccessResponse(request, "Leave request approved successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// POST /requests/:id/reject - Reject a leave request
app.post(
  "/requests/:id/reject",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveRequestIdParam),
  validateBody(leaveSchemas.rejectLeaveRequest),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { approverId, reason } = c.get("validatedBody");
    const service = new LeaveService(c.env.DB, c.env);

    const request = await service.rejectLeaveRequest(id, approverId, reason);

    return c.json(
      createSuccessResponse(request, "Leave request rejected"),
      HTTP_STATUS.OK,
    );
  },
);

// POST /requests/:id/cancel - Cancel a leave request
app.post(
  "/requests/:id/cancel",
  authMiddleware,
  validateParams(leaveSchemas.leaveRequestIdParam),
  validateBody(leaveSchemas.cancelLeaveRequest),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { userId, reason } = c.get("validatedBody");
    const user = c.get("user");
    const service = new LeaveService(c.env.DB, c.env);

    // Check if user is cancelling their own request or is admin/owner
    const request = await service.getLeaveRequest(id);
    if (!request) {
      throw notFound("Leave request not found");
    }

    if (user.role !== USER_ROLES.ADMIN && user.role !== USER_ROLES.SHOP_OWNER) {
      if (request.employeeId !== user.id) {
        throw forbidden("Access denied");
      }
    }

    const cancelledRequest = await service.cancelLeaveRequest(
      id,
      userId,
      reason,
    );

    return c.json(
      createSuccessResponse(
        cancelledRequest,
        "Leave request cancelled successfully",
      ),
      HTTP_STATUS.OK,
    );
  },
);

// ========================================
// Holiday Calendar
// ========================================

// GET /:restaurantId/holidays - Get holidays for a year
app.get(
  "/:restaurantId/holidays",
  authMiddleware,
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.restaurantIdParam),
  validateQuery(leaveSchemas.holidaysQuery),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { year } = c.get("validatedQuery");
    const service = new LeaveService(c.env.DB, c.env);

    const holidays = await service.getHolidays(restaurantId, year);

    return c.json(createSuccessResponse(holidays), HTTP_STATUS.OK);
  },
);

// GET /:restaurantId/working-day/:date - Check if a date is a working day
app.get(
  "/:restaurantId/working-day/:date",
  authMiddleware,
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.workingDayParam),
  async (c) => {
    const { restaurantId, date } = c.get("validatedParams");
    const service = new LeaveService(c.env.DB, c.env);

    const isWorking = await service.isWorkingDay(restaurantId, date);

    return c.json(
      createSuccessResponse({ date, isWorkingDay: isWorking }),
      HTTP_STATUS.OK,
    );
  },
);

export default app;
