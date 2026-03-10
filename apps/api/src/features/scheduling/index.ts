/**
 * Employee Scheduling Feature Module
 * Complete employee work scheduling and shift management functionality
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Feature metadata
const FEATURE_NAME = "scheduling";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class SchedulingModule implements FeatureModule {
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
        shiftTemplateManagement: true,
        employeeScheduleManagement: true,
        bulkScheduleCreation: true,
        conflictDetectionEngine: true,
        taiwanLaborLawCompliance: true,
        clockInOutTracking: true,
        overtimeCalculation: true,
        swapRequestWorkflow: true,
        employeeAvailability: true,
        restPeriodValidation: true,
        dailyHoursValidation: true,
        weeklyHoursValidation: true,
        consecutiveDaysValidation: true,
        leaveConflictIntegration: false, // To be implemented in Phase E
        realTimeScheduleStats: false, // To be implemented
        automaticNotifications: false, // To be implemented
      },
      endpoints: {
        shiftTemplates: [
          "GET /:restaurantId/templates - List shift templates",
          "GET /templates/:id - Get shift template details",
          "POST /:restaurantId/templates - Create shift template",
          "PUT /templates/:id - Update shift template",
          "DELETE /templates/:id - Delete shift template (soft)",
        ],
        employeeSchedules: [
          "GET /:restaurantId/schedules - List employee schedules",
          "GET /schedules/:id - Get schedule details",
          "POST /:restaurantId/schedules - Create employee schedule",
          "POST /:restaurantId/schedules/bulk - Bulk create schedules",
          "PUT /schedules/:id - Update schedule",
          "DELETE /schedules/:id - Cancel schedule",
        ],
        clockInOut: [
          "POST /schedules/:id/clock-in - Clock in to shift",
          "POST /schedules/:id/clock-out - Clock out from shift",
        ],
        swapRequests: [
          "POST /:restaurantId/swap-requests - Create swap request",
          "POST /swap-requests/:id/approve - Approve swap request",
        ],
      },
      supportedFeatures: {
        shiftTemplates: {
          regularShifts: true,
          splitShifts: true,
          overnightShifts: true,
          breakTimeManagement: true,
          colorCoding: true,
          iconSupport: true,
          hourlyRateTracking: true,
          overtimeMultipliers: true,
          employeeCapacityLimits: true,
          dayOfWeekRestrictions: true,
        },
        scheduling: {
          singleScheduleCreation: true,
          bulkScheduleCreation: true,
          dateRangeScheduling: true,
          dayOfWeekFiltering: true,
          statusTracking: true,
          notesSupport: true,
          managerNotes: true,
          auditTrail: true,
        },
        conflictDetection: {
          overlappingShiftDetection: true,
          restPeriodValidation: true,
          dailyHoursCheck: true,
          weeklyHoursCheck: true,
          consecutiveDaysCheck: true,
          leaveConflictCheck: false, // Phase E
          availabilityConflictCheck: false, // Phase B
          severityLevels: true, // error, warning, info
          realTimeValidation: true,
        },
        clockInOut: {
          actualTimeTracking: true,
          overtimeCalculation: true,
          lateClockInDetection: true,
          earlyClockOutDetection: true,
          noShowTracking: true,
          notesSupport: true,
          authorizationValidation: true,
        },
        swapRequests: {
          swapRequestCreation: true,
          coverRequestSupport: true,
          dropRequestSupport: true,
          openRequestsSupport: true,
          managerApproval: true,
          urgencyLevels: true,
          expirationManagement: true,
          reasonTracking: true,
        },
        compliance: {
          taiwanLaborStandardsAct: true,
          maxDailyHours: true, // 12 hours
          maxWeeklyHours: true, // 46 hours
          minRestPeriod: true, // 11 hours
          maxConsecutiveDays: true, // 6 days
          overtimeTracking: true,
          configutableSeverity: true,
        },
      },
      statistics: {
        totalEndpoints: 17,
        shiftTemplateEndpoints: 5,
        scheduleEndpoints: 6,
        clockInOutEndpoints: 2,
        swapRequestEndpoints: 2,
        conflictCheckEndpoints: 2,
        supportedShiftTypes: 3, // regular, split, overnight
        supportedStatuses: 5, // scheduled, confirmed, completed, cancelled, no_show
        supportedConflictTypes: 7,
      },
      dependencies: {
        database: "@makanmakan/database - SchedulingService",
        validation: "Zod schemas with Taiwan labor law rules",
        authentication: "Shared middleware with role-based access",
        monitoring: "ConsoleLogger",
        leaveIntegration: "Optional (Phase E)",
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
        total: 17,
        shiftTemplates: 5,
        employeeSchedules: 6,
        clockInOut: 2,
        swapRequests: 2,
        conflicts: 2,
      },
      supportedOperations: {
        crud: ["create", "read", "update", "delete"],
        workflow: ["clock-in", "clock-out", "swap", "approve", "reject"],
        bulk: ["bulk-create", "batch-update"],
        validation: ["conflict-check", "labor-law-check"],
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
          maxShiftDurationMinutes: 1440, // 24 hours
          maxBulkCreateEmployees: 50,
          maxBulkCreateDays: 90,
          conflictCheckEnabled: true,
        },
        scheduling: {
          supportedShiftTypes: ["regular", "split", "overnight"],
          supportedStatuses: [
            "scheduled",
            "confirmed",
            "completed",
            "cancelled",
            "no_show",
          ],
          defaultOvertimeMultiplier: 1.5,
          defaultMinEmployees: 1,
          defaultMaxEmployees: 10,
        },
        conflictDetection: {
          severityLevels: ["error", "warning", "info"],
          realTimeValidation: true,
          conflictTypes: [
            "overlapping_shifts",
            "insufficient_rest",
            "max_hours_exceeded",
            "consecutive_days_exceeded",
            "skill_mismatch",
            "leave_conflict",
            "availability_conflict",
          ],
        },
        clockInOut: {
          allowEarlyClockIn: true,
          earlyClockInMinutes: 15,
          allowLateClockOut: true,
          lateClockOutMinutes: 15,
          overtimeCalculationEnabled: true,
          noShowGracePeriodMinutes: 30,
        },
        swapRequests: {
          supportedTypes: ["swap", "cover", "drop"],
          supportedUrgencyLevels: ["low", "normal", "high", "urgent"],
          requireManagerApproval: true,
          defaultExpirationHours: 72,
          openRequestsEnabled: true,
        },
        taiwanLaborLaw: {
          maxDailyHours: 12, // Including overtime
          maxWeeklyHours: 46, // 40 regular + 6 overtime
          minRestPeriodHours: 11, // Between shifts
          maxConsecutiveDays: 6, // Work days
          standardWeeklyHours: 40,
          maxOvertimePerDay: 4,
          weekendOvertimeMultiplier: 1.34,
          holidayOvertimeMultiplier: 2.0,
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
export { SchedulingModule };

// Factory function for lazy initialization
let schedulingModuleInstance: SchedulingModule | null = null;
export function createSchedulingModule(): SchedulingModule {
  if (!schedulingModuleInstance) {
    schedulingModuleInstance = new SchedulingModule();
  }
  return schedulingModuleInstance;
}

// Export default for backward compatibility
export default {
  get routes() {
    return createSchedulingModule().routes;
  },
  getHealthStatus: () => createSchedulingModule().getHealthStatus(),
  getStatistics: () => createSchedulingModule().getStatistics(),
  getConfiguration: () => createSchedulingModule().getConfiguration(),
  cleanup: () => createSchedulingModule().cleanup(),
};

// Re-export types for external use
export type * from "./types";

// Re-export service for direct use
export { SchedulingService } from "@makanmakan/database";

// Re-export schemas for external validation
export { schedulingSchemas } from "./schemas/validation";
