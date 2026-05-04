/**
 * Leave Management Feature Module
 * Complete employee leave/time-off management functionality
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "leaves";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class LeavesModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;
  private logger: ConsoleLogger;

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME);
    this.routes = new Hono<{ Bindings: Env }>();
    this.setupRoutes();
    this.setupMiddleware();
    this.logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
    });
  }

  private setupRoutes() {
    // Mount feature routes
    this.routes.route("/", routes);
  }

  private setupMiddleware() {
    // Feature-specific middleware for performance monitoring
    this.routes.use("*", async (c, next) => {
      const start = Date.now();
      const method = c.req.method;
      const path = c.req.path;

      this.logger.debug(`${method} ${path} - starting`);

      try {
        await next();
        const duration = Date.now() - start;
        const status = c.res.status;

        // Log slow requests (> 1 second)
        if (duration > 1000) {
          this.logger.warn(`Slow request detected`, {
            method,
            path,
            duration,
            status,
          });
        } else {
          this.logger.debug(`${method} ${path} - completed`, {
            duration,
            status,
          });
        }
      } catch (error) {
        const duration = Date.now() - start;
        this.logger.error(
          `${method} ${path} - error`,
          error instanceof Error ? error : undefined,
          {
            duration,
            method,
            path,
          },
        );
        throw error;
      }
    });
  }

  // Health check endpoint with feature-specific status
  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        leaveTypeManagement: true,
        leaveBalanceTracking: true,
        leaveRequestWorkflow: true,
        multiLevelApproval: true,
        holidayCalendar: true,
        taiwanLaborLawCompliance: true,
        seniorityBasedAccrual: true,
        carryoverManagement: true,
        documentationRequirements: true,
        halfDaySupport: true,
        automaticBalanceCalculation: true,
        workingDayValidation: true,
      },
      endpoints: {
        leaveTypes: [
          "GET /:restaurantId/types - List leave types",
          "GET /types/:id - Get leave type details",
          "POST /:restaurantId/types - Create leave type",
          "PUT /types/:id - Update leave type",
          "DELETE /types/:id - Delete leave type (soft)",
        ],
        leaveBalances: [
          "GET /balances - Get employee leave balances",
          "POST /balances/adjust - Manually adjust balance",
          "POST /:restaurantId/balances/accrue - Accrue balances for all employees",
        ],
        leaveRequests: [
          "GET /:restaurantId/requests - List leave requests",
          "GET /requests/:id - Get request details",
          "POST /:restaurantId/requests - Create leave request",
          "POST /requests/:id/approve - Approve request",
          "POST /requests/:id/reject - Reject request",
          "POST /requests/:id/cancel - Cancel request",
        ],
        holidays: [
          "GET /:restaurantId/holidays - Get holidays for year",
          "GET /:restaurantId/working-day/:date - Check if working day",
        ],
      },
      supportedFeatures: {
        leaveTypes: {
          systemDefined: true, // Taiwan labor law types
          customTypes: true,
          accrualRules: true,
          seniorityBased: true,
          approvalWorkflow: true,
          documentationRules: true,
          paymentRates: true,
          genderRestrictions: true,
          roleRestrictions: true,
          carryoverRules: true,
        },
        leaveBalances: {
          automaticAccrual: true,
          manualAdjustments: true,
          carryoverTracking: true,
          expirationManagement: true,
          auditTrail: true,
          realTimeCalculation: true,
          yearlyTracking: true,
        },
        leaveRequests: {
          fullDaySupport: true,
          halfDaySupport: true,
          multiLevelApproval: true,
          balanceValidation: true,
          conflictDetection: false, // To be implemented with scheduling integration
          automaticNotifications: false, // To be implemented
          documentAttachment: true,
          emergencyContact: true,
          cancellation: true,
          withdrawal: true,
        },
        holidayCalendar: {
          taiwanPublicHolidays: true,
          companyHolidays: true,
          recurringEvents: true,
          compensatoryDays: true,
          workingDayValidation: true,
        },
        compliance: {
          taiwanLaborStandardsAct: true,
          annualLeaveRules: true,
          sickLeaveRules: true,
          maternityLeaveRules: true,
          paternityLeaveRules: true,
          menstrualLeaveRules: true,
          bereavementLeaveRules: true,
          marriageLeaveRules: true,
        },
      },
      statistics: {
        preConfiguredLeaveTypes: 10,
        taiwanPublicHolidays2025: 19,
        supportedApprovalLevels: 5,
        supportedLanguages: ["zh-TW", "en"],
      },
      dependencies: {
        database: "@makanmasak/database - LeaveService",
        validation: "Zod schemas with Taiwan labor law rules",
        authentication: "Shared middleware with role-based access",
        monitoring: "ConsoleLogger",
      },
    };
  }

  // Get feature statistics (for monitoring and debugging)
  getStatistics() {
    return {
      name: this.name,
      version: this.version,
      uptime: process.uptime ? `${Math.floor(process.uptime())}s` : "unknown",
      routes: {
        total: 16,
        leaveTypes: 5,
        leaveBalances: 3,
        leaveRequests: 6,
        holidays: 2,
      },
      supportedOperations: {
        crud: ["create", "read", "update", "delete"],
        workflow: ["submit", "approve", "reject", "cancel"],
        management: ["accrue", "adjust", "carryover"],
      },
    };
  }

  // Feature-specific configuration
  getConfiguration() {
    return {
      name: this.name,
      version: this.version,
      settings: {
        validation: {
          maxLeaveDaysPerRequest: 365,
          minNoticeDaysDefault: 0,
          maxApprovalLevels: 5,
          maxConsecutiveDaysDefault: 14,
        },
        accrual: {
          supportedTypes: ["yearly", "monthly", "none"],
          defaultAccrualType: "yearly",
          seniorityBasedSupported: true,
        },
        carryover: {
          enabled: true,
          defaultMaxDays: 7,
          defaultExpiryMonths: 3,
        },
        approval: {
          multiLevelSupported: true,
          autoApprovalSupported: true,
          autoEscalationSupported: true,
          defaultApprovalLevels: 1,
        },
        taiwanLaborLaw: {
          annualLeaveMaxDays: 30,
          sickLeaveMaxDays: 30,
          personalLeaveMaxDays: 14,
          maternityLeaveDays: 56,
          paternityLeaveDays: 7,
          marriageLeaveDays: 8,
          menstrualLeaveMaxDays: 12,
          familyCareLeaveDays: 7,
        },
      },
    };
  }

  // Cleanup method for graceful shutdown
  async cleanup() {
    this.logger.info(`${FEATURE_NAME} module cleaning up`);
    // Add any cleanup logic here
  }
}

// Export the feature module class
export { LeavesModule };

// Factory function for lazy initialization
let leavesModuleInstance: LeavesModule | null = null;
export function createLeavesModule(): LeavesModule {
  if (!leavesModuleInstance) {
    leavesModuleInstance = new LeavesModule();
  }
  return leavesModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createLeavesModule().routes;
  },
  getHealthStatus: () => createLeavesModule().getHealthStatus(),
  getStatistics: () => createLeavesModule().getStatistics(),
  getConfiguration: () => createLeavesModule().getConfiguration(),
  cleanup: () => createLeavesModule().cleanup(),
};

// Re-export types for external use
export type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestWithRelations,
  LeaveBalanceWithType,
  CreateLeaveTypeData,
  UpdateLeaveTypeData,
  CreateLeaveRequestData,
  LeaveRequestFilters,
  LeaveBalanceAdjustment,
} from "./types";

// Re-export service for direct use
export { LeaveService } from "@makanmasak/database";

// Re-export schemas for external validation
export { leaveSchemas } from "./schemas/validation";
