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
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../../shared/utils";

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
    try {
      const { restaurantId } = c.get("validatedParams");
      const service = new LeaveService(c.env.DB, c.env);

      const types = await service.getLeaveTypes(restaurantId);

      return c.json(createSuccessResponse(types), HTTP_STATUS.OK);
    } catch (error) {
      console.error("Get leave types error:", error);
      return c.json(
        createErrorResponse("Failed to fetch leave types"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// GET /types/:id - Get a specific leave type
app.get(
  "/types/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveTypeIdParam),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const service = new LeaveService(c.env.DB, c.env);

      const type = await service.getLeaveType(id);

      if (!type) {
        return c.json(
          createErrorResponse("Leave type not found"),
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return c.json(createSuccessResponse(type), HTTP_STATUS.OK);
    } catch (error) {
      console.error("Get leave type error:", error);
      return c.json(
        createErrorResponse("Failed to fetch leave type"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { restaurantId } = c.get("validatedParams");
      const data = c.get("validatedBody");
      const user = c.get("user");
      const service = new LeaveService(c.env.DB, c.env);

      const type = await service.createLeaveType({
        ...data,
        restaurantId,
        createdBy: user.id,
      });

      return c.json(
        createSuccessResponse(type, "Leave type created successfully"),
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      console.error("Create leave type error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to create leave type",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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
    } catch (error) {
      console.error("Update leave type error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to update leave type",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// DELETE /types/:id - Delete a leave type
app.delete(
  "/types/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(leaveSchemas.leaveTypeIdParam),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const service = new LeaveService(c.env.DB, c.env);

      const deleted = await service.deleteLeaveType(id);

      if (!deleted) {
        return c.json(
          createErrorResponse("Leave type not found or cannot be deleted"),
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return c.json(
        createSuccessResponse(null, "Leave type deleted successfully"),
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("Delete leave type error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to delete leave type",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");
      const service = new LeaveService(c.env.DB, c.env);

      // Check access: employees can only view their own balances
      if (
        user.role !== USER_ROLES.ADMIN &&
        user.role !== USER_ROLES.SHOP_OWNER
      ) {
        if (query.employeeId !== user.id) {
          return c.json(
            createErrorResponse("Access denied"),
            HTTP_STATUS.FORBIDDEN,
          );
        }
      }

      const year = query.year || new Date().getFullYear();
      const balances = await service.getEmployeeLeaveBalances(
        query.employeeId,
        year,
      );

      return c.json(createSuccessResponse(balances), HTTP_STATUS.OK);
    } catch (error) {
      console.error("Get leave balances error:", error);
      return c.json(
        createErrorResponse("Failed to fetch leave balances"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// POST /balances/adjust - Manually adjust leave balance
app.post(
  "/balances/adjust",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateBody(leaveSchemas.adjustLeaveBalance),
  async (c) => {
    try {
      const data = c.get("validatedBody");
      const service = new LeaveService(c.env.DB, c.env);

      const balance = await service.adjustLeaveBalance(data);

      return c.json(
        createSuccessResponse(balance, "Leave balance adjusted successfully"),
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("Adjust leave balance error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to adjust leave balance",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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
    } catch (error) {
      console.error("Accrue leave balances error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to accrue leave balances",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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
    } catch (error) {
      console.error("Get leave requests error:", error);
      return c.json(
        createErrorResponse("Failed to fetch leave requests"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// GET /requests/:id - Get a specific leave request
app.get(
  "/requests/:id",
  authMiddleware,
  validateParams(leaveSchemas.leaveRequestIdParam),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const user = c.get("user");
      const service = new LeaveService(c.env.DB, c.env);

      const request = await service.getLeaveRequest(id);

      if (!request) {
        return c.json(
          createErrorResponse("Leave request not found"),
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // Check access
      if (
        user.role !== USER_ROLES.ADMIN &&
        user.role !== USER_ROLES.SHOP_OWNER
      ) {
        if (request.employeeId !== user.id) {
          return c.json(
            createErrorResponse("Access denied"),
            HTTP_STATUS.FORBIDDEN,
          );
        }
      }

      return c.json(createSuccessResponse(request), HTTP_STATUS.OK);
    } catch (error) {
      console.error("Get leave request error:", error);
      return c.json(
        createErrorResponse("Failed to fetch leave request"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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

      // Check if employee has sufficient balance
      const balance = await service.getLeaveBalance(
        data.employeeId,
        data.leaveTypeId,
        new Date().getFullYear(),
      );

      if (balance && balance.remainingDays < totalDays) {
        return c.json(
          createErrorResponse(
            `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${totalDays} days`,
          ),
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const request = await service.createLeaveRequest({
        ...data,
        restaurantId,
        totalDays,
      });

      return c.json(
        createSuccessResponse(request, "Leave request created successfully"),
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      console.error("Create leave request error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to create leave request",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { id } = c.get("validatedParams");
      const { approverId, comments } = c.get("validatedBody");
      const service = new LeaveService(c.env.DB, c.env);

      const request = await service.approveLeaveRequest(
        id,
        approverId,
        comments,
      );

      return c.json(
        createSuccessResponse(request, "Leave request approved successfully"),
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("Approve leave request error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to approve leave request",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { id } = c.get("validatedParams");
      const { approverId, reason } = c.get("validatedBody");
      const service = new LeaveService(c.env.DB, c.env);

      const request = await service.rejectLeaveRequest(id, approverId, reason);

      return c.json(
        createSuccessResponse(request, "Leave request rejected"),
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("Reject leave request error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to reject leave request",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// POST /requests/:id/cancel - Cancel a leave request
app.post(
  "/requests/:id/cancel",
  authMiddleware,
  validateParams(leaveSchemas.leaveRequestIdParam),
  validateBody(leaveSchemas.cancelLeaveRequest),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const { userId, reason } = c.get("validatedBody");
      const user = c.get("user");
      const service = new LeaveService(c.env.DB, c.env);

      // Check if user is cancelling their own request or is admin/owner
      const request = await service.getLeaveRequest(id);
      if (!request) {
        return c.json(
          createErrorResponse("Leave request not found"),
          HTTP_STATUS.NOT_FOUND,
        );
      }

      if (
        user.role !== USER_ROLES.ADMIN &&
        user.role !== USER_ROLES.SHOP_OWNER
      ) {
        if (request.employeeId !== user.id) {
          return c.json(
            createErrorResponse("Access denied"),
            HTTP_STATUS.FORBIDDEN,
          );
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
    } catch (error) {
      console.error("Cancel leave request error:", error);
      return c.json(
        createErrorResponse(
          error instanceof Error
            ? error.message
            : "Failed to cancel leave request",
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { restaurantId } = c.get("validatedParams");
      const { year } = c.get("validatedQuery");
      const service = new LeaveService(c.env.DB, c.env);

      const holidays = await service.getHolidays(restaurantId, year);

      return c.json(createSuccessResponse(holidays), HTTP_STATUS.OK);
    } catch (error) {
      console.error("Get holidays error:", error);
      return c.json(
        createErrorResponse("Failed to fetch holidays"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// GET /:restaurantId/working-day/:date - Check if a date is a working day
app.get(
  "/:restaurantId/working-day/:date",
  authMiddleware,
  requireRestaurantAccess("restaurantId"),
  validateParams(leaveSchemas.workingDayParam),
  async (c) => {
    try {
      const { restaurantId, date } = c.get("validatedParams");
      const service = new LeaveService(c.env.DB, c.env);

      const isWorking = await service.isWorkingDay(restaurantId, date);

      return c.json(
        createSuccessResponse({ date, isWorkingDay: isWorking }),
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("Check working day error:", error);
      return c.json(
        createErrorResponse("Failed to check working day"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

export default app;
