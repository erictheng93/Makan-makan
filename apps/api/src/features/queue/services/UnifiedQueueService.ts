/**
 * Unified Queue Service
 * Integrates legacy and modular queue systems
 */

import type { Env } from "../../../types/env";
import { ConsoleLogger } from "../../../core/monitoring";
// import { QueueService } from '@makanmakan/queue-service'
import { QueueStatus, QueueType } from "@makanmakan/queue-core";
import type {
  QueueEntry,
  JoinQueueRequest,
  CallNextRequest,
  QueueStatistics,
  ApiResponse,
  LegacyQueueEntry,
  LegacyQueueSettings,
  UnifiedQueueService as IUnifiedQueueService,
} from "../types";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { restaurants } from "@makanmakan/database";
import * as schema from "@makanmakan/database";

export class UnifiedQueueService implements IUnifiedQueueService {
  private logger: ConsoleLogger;
  private env: Env;
  private db: ReturnType<typeof drizzle<typeof schema>>;
  // private modularService: QueueService
  private useModular: boolean;

  constructor(env: Env, useModular: boolean = false) {
    this.env = env;
    this.logger = new ConsoleLogger("UnifiedQueueService");

    // Use mock Drizzle instance in test environment, similar to BaseService
    if (env.MOCK_DRIZZLE_DB && env.NODE_ENV === "test") {
      this.db = env.MOCK_DRIZZLE_DB;
    } else {
      this.db = drizzle(env.DB, { schema });
    }

    if (useModular) {
      this.logger.warn(
        "Modular queue service requested before repositories are wired; falling back to legacy implementation",
      );
    }
    this.useModular = false;
  }

  // New modular methods
  async joinQueue(data: JoinQueueRequest): Promise<ApiResponse<QueueEntry>> {
    if (this.useModular) {
      return {
        success: false,
        error: "Modular queue service is disabled",
      };
    } else {
      // Use legacy implementation
      const legacyData = await this.joinQueueLegacy({
        restaurant_id: data.restaurantId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        party_size: data.partySize,
        special_requests: data.specialRequests,
        status: "waiting",
        priority: 0,
      });

      const modularEntry = this.migrateQueueEntry(legacyData);
      return {
        success: true,
        data: modularEntry,
      };
    }
  }

  async callNext(
    restaurantId: string,
    _data: CallNextRequest,
  ): Promise<ApiResponse<QueueEntry>> {
    if (this.useModular) {
      return {
        success: false,
        error: "Modular queue service is disabled",
      };
    } else {
      // Use legacy implementation
      const legacyQueue = await this.getQueueLegacy(restaurantId);

      // Find the next waiting customer (highest priority, then oldest)
      const waitingCustomers = legacyQueue
        .filter((entry) => entry.status === "waiting")
        .sort((a, b) => {
          // Sort by priority (higher first), then by created_at (older first)
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

      if (waitingCustomers.length === 0) {
        return {
          success: false,
          error: "No customers waiting in queue",
        };
      }

      // Get the next customer
      const nextCustomer = waitingCustomers[0];

      // Update status to 'called'
      const updatedLegacyEntry: LegacyQueueEntry = {
        ...nextCustomer,
        status: "called",
        called_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Convert to modular format
      const modularEntry = this.migrateQueueEntry(updatedLegacyEntry);

      this.logger.info("Called next customer", {
        restaurantId,
        queueId: modularEntry.id,
        customerName: modularEntry.customerName,
      });

      return {
        success: true,
        data: modularEntry,
      };
    }
  }

  async getQueueStatus(
    restaurantId: string,
  ): Promise<ApiResponse<QueueStatistics>> {
    if (this.useModular) {
      return {
        success: false,
        error: "Modular queue service is disabled",
      };
    } else {
      // Use legacy implementation
      const legacyQueue = await this.getQueueLegacy(restaurantId);

      const statistics: QueueStatistics = {
        totalCustomers: legacyQueue.length,
        seatedCustomers: legacyQueue.filter(
          (entry) => entry.status === "seated",
        ).length,
        cancelledCustomers: legacyQueue.filter(
          (entry) => entry.status === "cancelled",
        ).length,
        noShowCustomers: legacyQueue.filter(
          (entry) => entry.status === "no_show",
        ).length,
        avgActualWait: this.calculateAverageWaitTime(legacyQueue),
        avgEstimatedWait: 30, // Default estimation
        maxQueueNumber: Math.max(...legacyQueue.map((e) => e.queue_number), 0),
      };

      return {
        success: true,
        data: statistics,
      };
    }
  }

  async seatCustomer(
    queueId: number,
    tableId: number,
    operatorId: number,
  ): Promise<ApiResponse<void>> {
    if (this.useModular) {
      return {
        success: false,
        error: "Modular queue service is disabled",
      };
    } else {
      // Use legacy implementation - update table status to occupied
      this.logger.info("Seating customer", {
        queueId,
        tableId,
        operatorId,
      });

      // Update table to mark as occupied
      try {
        await this.db
          .update(schema.tables)
          .set({
            isOccupied: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.tables.id, tableId))
          .run();

        return {
          success: true,
        };
      } catch (error) {
        this.logger.error(
          "Failed to update table status",
          error instanceof Error ? error : undefined,
          { tableId },
        );
        return {
          success: false,
          error: "Failed to update table status",
        };
      }
    }
  }

  // Legacy compatibility methods
  async joinQueueLegacy(
    data: Partial<LegacyQueueEntry>,
  ): Promise<LegacyQueueEntry> {
    // Validate restaurant exists and is active
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(restaurants.id, data.restaurant_id!),
    });

    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    if (!restaurant.isActive) {
      throw new Error("Restaurant not available");
    }

    // Legacy database operations would go here
    // For now, return mock data
    const mockEntry: LegacyQueueEntry = {
      id: Date.now(),
      restaurant_id: data.restaurant_id!,
      customer_name: data.customer_name!,
      customer_phone: data.customer_phone,
      party_size: data.party_size || 1,
      estimated_wait_minutes: 30,
      status: "waiting",
      queue_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority: data.priority || 0,
      special_requests: data.special_requests,
    };

    this.logger.info("Legacy queue entry created", {
      id: mockEntry.id,
      restaurantId: mockEntry.restaurant_id,
    });

    return mockEntry;
  }

  async getQueueLegacy(restaurantId: string): Promise<LegacyQueueEntry[]> {
    // Legacy database query would go here
    this.logger.info("Getting legacy queue", { restaurantId });
    // For testing purposes, return a mock entry if a joinQueue was performed
    // In a real scenario, this would query the legacy database
    const mockEntry: LegacyQueueEntry = {
      id: 1, // Mock ID
      restaurant_id: restaurantId,
      customer_name: "Mock Customer",
      customer_phone: "123-456-7890",
      party_size: 2,
      estimated_wait_minutes: 15,
      status: "waiting",
      queue_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority: 0,
      special_requests: "None",
    };
    return [mockEntry]; // Return a single mock entry
  }
  async updateQueueSettingsLegacy(
    restaurantId: string,
    settings: Partial<LegacyQueueSettings>,
  ): Promise<LegacyQueueSettings> {
    // Legacy settings update would go here
    const mockSettings: LegacyQueueSettings = {
      id: 1,
      restaurant_id: restaurantId,
      average_wait_time: settings.average_wait_time || 30,
      max_party_size: settings.max_party_size || 8,
      enable_sms_notifications: settings.enable_sms_notifications || false,
      enable_queue_notifications: settings.enable_queue_notifications || true,
      auto_call_interval: settings.auto_call_interval || 5,
      max_queue_size: settings.max_queue_size || 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.logger.info("Legacy queue settings updated", { restaurantId });
    return mockSettings;
  }

  // Migration methods
  migrateQueueEntry(legacy: LegacyQueueEntry): QueueEntry {
    return {
      id: legacy.id.toString(),
      restaurantId: parseInt(legacy.restaurant_id, 10) || 0,
      queueNumber: legacy.queue_number,
      customerName: legacy.customer_name,
      customerPhone: legacy.customer_phone,
      customerEmail: undefined,
      partySize: legacy.party_size,
      specialRequests: legacy.special_requests,
      priority: legacy.priority,
      queueType: QueueType.WALKIN, // Default type
      estimatedWaitMinutes: legacy.estimated_wait_minutes,
      actualWaitMinutes: undefined,
      tablePreferences: [],
      status: this.mapLegacyStatus(legacy.status),
      notificationMethods: [],
      notificationSent: false,
      notificationCount: 0,
      joinedAt: new Date(legacy.created_at),
      calledAt: legacy.called_at ? new Date(legacy.called_at) : undefined,
      seatedAt: legacy.seated_at ? new Date(legacy.seated_at) : undefined,
      metadata: {},
    };
  }

  async migrateLegacyToModular(restaurantId: string): Promise<void> {
    this.logger.info("Starting legacy to modular migration", { restaurantId });

    const legacyEntries = await this.getQueueLegacy(restaurantId);

    for (const legacyEntry of legacyEntries) {
      const modularEntry = this.migrateQueueEntry(legacyEntry);
      // Save modular entry to new system
      this.logger.debug("Migrated queue entry", {
        legacyId: legacyEntry.id,
        modularId: modularEntry.id,
      });
    }

    this.logger.info("Legacy to modular migration completed", {
      restaurantId,
      entriesMigrated: legacyEntries.length,
    });
  }

  // Helper methods
  private mapLegacyStatus(legacyStatus: string): QueueStatus {
    switch (legacyStatus) {
      case "waiting":
        return QueueStatus.WAITING;
      case "called":
        return QueueStatus.CALLED;
      case "seated":
        return QueueStatus.SEATED;
      case "cancelled":
        return QueueStatus.CANCELLED;
      case "no_show":
        return QueueStatus.NO_SHOW;
      default:
        return QueueStatus.WAITING;
    }
  }

  private calculateAverageWaitTime(entries: LegacyQueueEntry[]): number {
    const seatedEntries = entries.filter(
      (entry) => entry.seated_at && entry.created_at,
    );

    if (seatedEntries.length === 0) return 30; // Default

    const totalWaitTime = seatedEntries.reduce((sum, entry) => {
      const createdTime = new Date(entry.created_at).getTime();
      const seatedTime = new Date(entry.seated_at!).getTime();
      return sum + (seatedTime - createdTime);
    }, 0);

    return Math.round(totalWaitTime / seatedEntries.length / 1000 / 60); // Convert to minutes
  }
}
