/**
 * BackupService Tests
 * Comprehensive test suite for backup service
 * Updated for Drizzle ORM migration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BackupService } from "../BackupService";
import type {
  CreateBackupRequest,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupRecord,
  BackupConfiguration,
} from "@makanmasak/shared-types";

// ========================================
// Mock Drizzle ORM and database module
// ========================================

// In-memory stores for test data
const backupsStore = new Map<string, any>();
const restoreOpsStore = new Map<string, any>();
const auditLogsStore: any[] = [];

// Create mock chain builder for Drizzle queries
const createChainMock = () => {
  let _whereCondition: any = null;
  let _limitValue: number | undefined;
  let _offsetValue: number | undefined;
  let _table: any = null;
  let _values: any = null;

  const chain: any = {
    from: vi.fn().mockImplementation((table: any) => {
      _table = table;
      return chain;
    }),
    where: vi.fn().mockImplementation((condition: any) => {
      _whereCondition = condition;
      return chain;
    }),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation((limit: number) => {
      _limitValue = limit;
      return chain;
    }),
    offset: vi.fn().mockImplementation((offset: number) => {
      _offsetValue = offset;
      return chain;
    }),
    set: vi.fn().mockImplementation((values: any) => {
      _values = values;
      return chain;
    }),
    values: vi.fn().mockImplementation((values: any) => {
      _values = values;
      return chain;
    }),
    then: undefined as never, // will be set below
  };

  return chain;
};

// Mock drizzle instance
const mockDrizzleDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  run: vi.fn(),
};

// Setup select mock to return chainable object that resolves properly
const setupSelectMock = () => {
  const selectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  // Make it thenable - resolves to array
  selectChain.then = (resolve: any, reject: any) => {
    return Promise.resolve([]).then(resolve, reject);
  };

  mockDrizzleDb.select.mockReturnValue(selectChain);
  return selectChain;
};

const setupInsertMock = () => {
  const insertChain: any = {
    values: vi.fn().mockReturnThis(),
  };

  insertChain.then = (resolve: any, reject: any) => {
    return Promise.resolve({ meta: { changes: 1 } }).then(resolve, reject);
  };

  mockDrizzleDb.insert.mockReturnValue(insertChain);
  return insertChain;
};

const setupUpdateMock = () => {
  const updateChain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  };

  updateChain.then = (resolve: any, reject: any) => {
    return Promise.resolve({ meta: { changes: 1 } }).then(resolve, reject);
  };

  mockDrizzleDb.update.mockReturnValue(updateChain);
  return updateChain;
};

const setupDeleteMock = () => {
  const deleteChain: any = {
    where: vi.fn().mockReturnThis(),
  };

  deleteChain.then = (resolve: any, reject: any) => {
    return Promise.resolve({ meta: { changes: 1 } }).then(resolve, reject);
  };

  mockDrizzleDb.delete.mockReturnValue(deleteChain);
  return deleteChain;
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDrizzleDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((col: any) => ({ type: "desc", col })),
  asc: vi.fn((col: any) => ({ type: "asc", col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(() => "count"),
  gte: vi.fn((...args: any[]) => ({ type: "gte", args })),
  lte: vi.fn((...args: any[]) => ({ type: "lte", args })),
  sum: vi.fn(),
  avg: vi.fn(),
  inArray: vi.fn((...args: any[]) => ({ type: "inArray", args })),
  isNotNull: vi.fn(),
}));

vi.mock("@makanmasak/database", () => ({
  backupRecords: {
    id: "id",
    restaurantId: "restaurant_id",
    status: "status",
    backupType: "backup_type",
    startedAt: "started_at",
    completedAt: "completed_at",
    fileSize: "file_size",
    name: "name",
  },
  backupAlerts: {
    id: "id",
    restaurantId: "restaurant_id",
    acknowledged: "acknowledged",
    resolved: "resolved",
    resolvedAt: "resolved_at",
    triggeredAt: "triggered_at",
  },
  backupAuditLogs: { id: "id", restaurantId: "restaurant_id" },
  restoreOperations: { id: "id", restaurantId: "restaurant_id" },
  backupConfigurations: { id: "id", restaurantId: "restaurant_id" },
}));

// ========================================
// Mock Services
// ========================================

class MockStorageService {
  public storedBackups: Map<string, string> = new Map();
  public shouldFail = false;

  async storeBackup(backup: any, data: string, _provider: string) {
    if (this.shouldFail) throw new Error("Storage failed");
    const path = `backups/${backup.id}.json`;
    this.storedBackups.set(backup.id, data);
    return {
      storage_path: path,
      checksum: "mock-checksum-" + Date.now(),
    };
  }

  async backupExists(backup: any): Promise<boolean> {
    return this.storedBackups.has(backup.id);
  }

  async deleteBackup(backup: any): Promise<void> {
    this.storedBackups.delete(backup.id);
  }

  async generateDownloadResponse(backup: any): Promise<Response> {
    const data = this.storedBackups.get(backup.id) || "{}";
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
    });
  }

  reset() {
    this.storedBackups.clear();
    this.shouldFail = false;
  }
}

class MockConfigService {
  private configs: Map<string, BackupConfiguration> = new Map();

  async getConfigurationById(id: string): Promise<BackupConfiguration | null> {
    return this.configs.get(id) || null;
  }

  async getDefaultConfiguration(
    _restaurantId: string,
  ): Promise<BackupConfiguration | null> {
    return {
      id: "default-config",
      restaurant_id: "rest-1",
      name: "Default Config",
      backup_type: "full",
      schedule_enabled: false,
      retention_days: 30,
      include_tables: ["orders", "menu_items"],
      exclude_tables: [],
      compression_enabled: true,
      encryption_enabled: true,
      storage_provider: "r2",
      max_parallel_backups: 1,
      notifications_enabled: false,
      notification_channels: [],
      created_by: "system",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  setConfig(id: string, config: BackupConfiguration) {
    this.configs.set(id, config);
  }
}

class MockValidationService {
  public shouldFailValidation = false;
  public shouldFailLimits = false;
  public shouldFailQuota = false;

  async validateCreateBackupRequest(
    _request: CreateBackupRequest,
  ): Promise<void> {
    if (this.shouldFailValidation) {
      throw new Error("Validation failed");
    }
  }

  async checkBackupLimits(_restaurantId: string): Promise<void> {
    if (this.shouldFailLimits) {
      throw new Error("Backup limit exceeded");
    }
  }

  async checkStorageQuota(_restaurantId: string): Promise<void> {
    if (this.shouldFailQuota) {
      throw new Error("Storage quota exceeded");
    }
  }

  async validateTableNames(tables: string[]): Promise<void> {
    if (tables.includes("invalid_table")) {
      throw new Error("Invalid table name");
    }
  }

  async validateRestoreRequest(request: RestoreBackupRequest): Promise<void> {
    if (!request.safety_confirmation?.backup_integrity_verified) {
      throw new Error("Backup integrity not verified");
    }
  }

  reset() {
    this.shouldFailValidation = false;
    this.shouldFailLimits = false;
    this.shouldFailQuota = false;
  }
}

// ========================================
// Setup
// ========================================

describe("BackupService", () => {
  let service: BackupService;
  let mockStorage: MockStorageService;
  let mockConfig: MockConfigService;
  let mockValidation: MockValidationService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = new MockStorageService();
    mockConfig = new MockConfigService();
    mockValidation = new MockValidationService();

    // Setup default mocks
    setupInsertMock();
    setupUpdateMock();
    setupDeleteMock();

    // Default select returns empty array
    const selectChain = setupSelectMock();

    service = new BackupService(
      {} as never, // D1Database - mocked via drizzle
      mockStorage as never,
      mockConfig as never,
      mockValidation as never,
    );
  });

  // ========================================
  // 1. Create Backup Tests
  // ========================================

  describe("Create Backup", () => {
    it("should successfully create a backup", async () => {
      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Daily Backup",
        backup_type: "full",
        force_immediate: false,
      };

      const result = await service.createBackup(request, "user-1");

      expect(result.status).toBe("pending");
      expect(result.backup_id).toBeDefined();
      expect(result.message).toContain("scheduled successfully");
      expect(result.estimated_duration_minutes).toBeGreaterThan(0);
      expect(mockDrizzleDb.insert).toHaveBeenCalled();
    });

    it("should throw error on validation failure", async () => {
      mockValidation.shouldFailValidation = true;

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Validation failed",
      );
    });

    it("should throw error when backup limit reached", async () => {
      mockValidation.shouldFailLimits = true;

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Backup limit exceeded",
      );
    });

    it("should throw error when storage quota exceeded", async () => {
      mockValidation.shouldFailQuota = true;

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Storage quota exceeded",
      );
    });

    it("should throw error on invalid table names", async () => {
      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
        include_tables: ["invalid_table"],
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Invalid table name",
      );
    });

    it("should throw error when configuration not found", async () => {
      mockConfig.getDefaultConfiguration = async () => null;

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Backup configuration not found",
      );
    });

    it("should create backup with custom configuration", async () => {
      const customConfig: BackupConfiguration = {
        id: "custom-config",
        restaurant_id: "rest-1",
        name: "Custom Config",
        backup_type: "incremental",
        schedule_enabled: false,
        retention_days: 7,
        include_tables: ["orders"],
        exclude_tables: ["audit_logs"],
        compression_enabled: true,
        encryption_enabled: false,
        storage_provider: "external",
        max_parallel_backups: 1,
        notifications_enabled: false,
        notification_channels: [],
        created_by: "user-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockConfig.setConfig("custom-config", customConfig);

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Custom Backup",
        backup_type: "incremental",
        configuration_id: "custom-config",
      };

      const result = await service.createBackup(request, "user-1");

      expect(result.status).toBe("pending");
      expect(result.backup_id).toBeDefined();
    });

    it("should reject custom configuration from another restaurant", async () => {
      const customConfig: BackupConfiguration = {
        id: "foreign-config",
        restaurant_id: "rest-2",
        name: "Foreign Config",
        backup_type: "incremental",
        schedule_enabled: false,
        retention_days: 7,
        include_tables: ["orders"],
        exclude_tables: [],
        compression_enabled: true,
        encryption_enabled: false,
        storage_provider: "r2",
        max_parallel_backups: 1,
        notifications_enabled: false,
        notification_channels: [],
        created_by: "user-2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockConfig.setConfig("foreign-config", customConfig);

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Cross Tenant Backup",
        backup_type: "incremental",
        configuration_id: "foreign-config",
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Backup configuration not found",
      );
    });

    it("should execute backup immediately when force_immediate is true", async () => {
      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Immediate Backup",
        backup_type: "full",
        force_immediate: true,
      };

      const result = await service.createBackup(request, "user-1");

      expect(result.status).toBe("completed");
      expect(result.backup_id).toBeDefined();
      expect(result.checksum).toBeTruthy();
      expect(result.manifest?.rowCounts).toBeDefined();
    });
  });

  // ========================================
  // 2. List Backups Tests
  // ========================================

  describe("List Backups", () => {
    it("should list backups", async () => {
      // Setup select to return mock backup data and count
      const mockBackup = {
        id: "backup-1",
        restaurantId: "rest-1",
        name: "Test Backup",
        backupType: "full",
        status: "pending",
        fileSize: 0,
        compressedSize: 0,
        recordsCount: 0,
        tablesIncluded: ["orders"],
        storageProvider: "r2",
        storagePath: "",
        encryptionEnabled: false,
        checksum: "",
        startedAt: new Date().toISOString(),
        createdBy: "user-1",
        metadata: {},
      };

      // First select call returns backup data, second returns count
      let callCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        callCount++;
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
        };
        if (callCount === 1) {
          chain.then = (resolve: any, reject: any) =>
            Promise.resolve([mockBackup]).then(resolve, reject);
        } else {
          chain.then = (resolve: any, reject: any) =>
            Promise.resolve([{ total: 1 }]).then(resolve, reject);
        }
        return chain;
      });

      const query: ListBackupsQuery = {
        restaurant_id: "rest-1",
      };

      const result = await service.listBackups(query);

      expect(result.backups.length).toBeGreaterThan(0);
      expect(result.total).toBe(1);
    });

    it("should support filtering by status", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const query: ListBackupsQuery = {
        restaurant_id: "rest-1",
        status: "pending",
      };

      const result = await service.listBackups(query);
      expect(result.backups).toBeDefined();
      expect(mockDrizzleDb.select).toHaveBeenCalled();
    });

    it("should support pagination", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const query: ListBackupsQuery = {
        restaurant_id: "rest-1",
        page: 1,
        limit: 2,
      };

      const result = await service.listBackups(query);
      expect(result.backups).toBeDefined();
    });

    it("should support sorting", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const query: ListBackupsQuery = {
        restaurant_id: "rest-1",
        sort_by: "created_at",
        sort_order: "desc",
      };

      const result = await service.listBackups(query);
      expect(result.backups).toBeDefined();
    });
  });

  // ========================================
  // 3. Get Backup Tests
  // ========================================

  describe("Get Backup", () => {
    it("should get backup by ID", async () => {
      const mockBackup = {
        id: "backup-1",
        restaurantId: "rest-1",
        name: "Test Backup",
        backupType: "full",
        status: "pending",
        fileSize: 0,
        compressedSize: 0,
        recordsCount: 0,
        tablesIncluded: ["orders"],
        storageProvider: "r2",
        storagePath: "",
        encryptionEnabled: false,
        checksum: "",
        startedAt: new Date().toISOString(),
        createdBy: "user-1",
        metadata: {},
      };

      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([mockBackup]).then(resolve, reject);
        return chain;
      });

      const backup = await service.getBackupById("backup-1");

      expect(backup).toBeDefined();
      expect(backup?.id).toBe("backup-1");
      expect(backup?.name).toBe("Test Backup");
    });

    it("should return null when backup does not exist", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const backup = await service.getBackupById("non-existent-id");

      expect(backup).toBeNull();
    });
  });

  // ========================================
  // 4. Delete Backup Tests
  // ========================================

  describe("Delete Backup", () => {
    it("should successfully delete a backup", async () => {
      const mockBackup = {
        id: "backup-1",
        restaurantId: "rest-1",
        name: "Test Backup",
        backupType: "full",
        status: "completed",
        fileSize: 100,
        compressedSize: 50,
        recordsCount: 10,
        tablesIncluded: ["orders"],
        storageProvider: "r2",
        storagePath: "/path",
        encryptionEnabled: false,
        checksum: "abc",
        startedAt: new Date().toISOString(),
        createdBy: "user-1",
        metadata: {},
      };

      // Select returns the backup (for getBackupRecord)
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([mockBackup]).then(resolve, reject);
        return chain;
      });

      await service.deleteBackup("backup-1", "user-1");

      expect(mockDrizzleDb.delete).toHaveBeenCalled();
      expect(mockDrizzleDb.insert).toHaveBeenCalled(); // audit log
    });

    it("should throw error when backup does not exist", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      await expect(
        service.deleteBackup("non-existent-id", "user-1"),
      ).rejects.toThrow("Backup not found");
    });
  });

  // ========================================
  // 5. Restore Backup Tests
  // ========================================

  describe("Restore Backup", () => {
    it("should throw error on safety confirmation failure", async () => {
      const request: RestoreBackupRequest = {
        restaurant_id: "rest-1",
        backup_id: "backup-1",
        restore_type: "full",
        overwrite_existing: true,
        safety_confirmation: {
          backup_integrity_verified: false,
          data_loss_risk_acknowledged: true,
          confirmation_phrase: "RESTORE",
        },
      };

      await expect(
        service.restoreFromBackup(request, "user-1"),
      ).rejects.toThrow("Backup integrity not verified");
    });
  });

  // ========================================
  // 6. System Health Tests
  // ========================================

  describe("System Health", () => {
    it("should return system health status", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              totalRestaurants: 1,
              totalBackups: 5,
              runningBackups: 0,
              failedBackups24h: 0,
              avgSize: 1000,
              totalBytes: 5000,
              totalFiles: 5,
            },
          ]).then(resolve, reject);
        return chain;
      });

      const health = await service.getSystemHealth();

      expect(health.overall_status).toBeDefined();
      expect(
        ["healthy", "warning", "critical"].includes(health.overall_status),
      ).toBe(true);
      expect(health.total_restaurants).toBeGreaterThanOrEqual(0);
      expect(health.storage_usage).toBeDefined();
      expect(health.performance_metrics).toBeDefined();
      expect(health.alerts_summary).toBeDefined();
    });
  });

  // ========================================
  // 7. Restaurant Metrics Tests
  // ========================================

  describe("Restaurant Metrics", () => {
    it("should return restaurant metrics", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              total_backups: 3,
              successful_backups: 2,
              failed_backups: 1,
              avg_backup_size: 500,
              total_storage_used: 1500,
            },
          ]).then(resolve, reject);
        return chain;
      });

      const metrics = await service.getRestaurantMetrics("rest-1", "week");

      expect(metrics).toBeDefined();
      expect(metrics.total_backups).toBeGreaterThanOrEqual(0);
    });

    it("should support different timeframes", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              total_backups: 0,
              successful_backups: 0,
              failed_backups: 0,
              avg_backup_size: 0,
              total_storage_used: 0,
            },
          ]).then(resolve, reject);
        return chain;
      });

      const timeframes = ["hour", "day", "week", "month"];

      for (const timeframe of timeframes) {
        const metrics = await service.getRestaurantMetrics("rest-1", timeframe);
        expect(metrics).toBeDefined();
      }
    });
  });

  // ========================================
  // 8. Restaurant Alerts Tests
  // ========================================

  describe("Restaurant Alerts", () => {
    it("should return restaurant alerts", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const alerts = await service.getRestaurantAlerts("rest-1");

      expect(Array.isArray(alerts)).toBe(true);
    });

    it("should return only unresolved alerts", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([]).then(resolve, reject);
        return chain;
      });

      const alerts = await service.getRestaurantAlerts("rest-1", true);

      expect(Array.isArray(alerts)).toBe(true);
    });

    it("should normalize alert rows to the public backup alert contract", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              id: "alert-1",
              restaurantId: "rest-1",
              alertType: "backup_failed",
              severity: "high",
              message: "Backup failed",
              details: { title: "Backup Failure" },
              acknowledged: 0,
              resolved: 0,
              triggeredAt: "2024-01-01T00:00:00.000Z",
            },
          ]).then(resolve, reject);
        return chain;
      });

      const alerts = await service.getRestaurantAlerts("rest-1");

      expect(alerts[0]).toEqual(
        expect.objectContaining({
          id: "alert-1",
          restaurant_id: "rest-1",
          alert_type: "backup_failed",
          title: "Backup Failure",
          triggered_at: "2024-01-01T00:00:00.000Z",
          acknowledged: false,
          resolved: false,
        }),
      );
    });

    it("should acknowledge an alert and audit the action", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              id: "alert-1",
              restaurantId: "rest-1",
              alertType: "backup_failed",
              severity: "high",
              message: "Backup failed",
              acknowledged: 0,
              resolved: 0,
              triggeredAt: "2024-01-01T00:00:00.000Z",
            },
          ]).then(resolve, reject);
        return chain;
      });

      const alert = await service.acknowledgeAlert("alert-1", "user-1");

      expect(alert.acknowledged).toBe(true);
      expect(alert.acknowledged_by).toBe("user-1");
      expect(mockDrizzleDb.update).toHaveBeenCalledOnce();
      expect(mockDrizzleDb.insert).toHaveBeenCalled();
    });

    it("should resolve an alert and audit the action", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        chain.then = (resolve: any, reject: any) =>
          Promise.resolve([
            {
              id: "alert-2",
              restaurantId: "rest-1",
              alertType: "backup_failed",
              severity: "high",
              message: "Backup failed",
              acknowledged: 0,
              resolved: 0,
              triggeredAt: "2024-01-01T00:00:00.000Z",
            },
          ]).then(resolve, reject);
        return chain;
      });

      const alert = await service.resolveAlert("alert-2", "user-1");

      expect(alert.resolved).toBe(true);
      expect(alert.resolved_at).toEqual(expect.any(String));
      expect(mockDrizzleDb.update).toHaveBeenCalledOnce();
      expect(mockDrizzleDb.insert).toHaveBeenCalled();
    });
  });

  // ========================================
  // 9. Error Handling Tests
  // ========================================

  describe("Error Handling", () => {
    it("should handle storage service failure", async () => {
      mockStorage.shouldFail = true;

      const request: CreateBackupRequest = {
        restaurant_id: "rest-1",
        name: "Test Backup",
        backup_type: "full",
        force_immediate: true,
      };

      await expect(service.createBackup(request, "user-1")).rejects.toThrow(
        "Storage failed",
      );
    });

    it("should handle database errors", async () => {
      mockDrizzleDb.select.mockImplementation(() => {
        throw new Error("Database error");
      });

      const query: ListBackupsQuery = {
        restaurant_id: "rest-1",
      };

      await expect(service.listBackups(query)).rejects.toThrow();
    });
  });

  // ========================================
  // 10. Download Backup Tests
  // ========================================

  describe("Download Backup", () => {
    it("should successfully download a backup", async () => {
      const mockBackup: BackupRecord = {
        id: "backup-1",
        restaurant_id: "rest-1",
        configuration_id: "config-1",
        name: "Test Backup",
        backup_type: "full",
        status: "completed",
        file_size: 100,
        compressed_size: 50,
        compression_enabled: true,
        records_count: 10,
        tables_included: ["orders"],
        storage_provider: "r2",
        storage_path: "/path",
        encryption_enabled: false,
        checksum: "abc",
        started_at: new Date().toISOString(),
        created_by: "user-1",
        metadata: {
          tables_info: [],
          performance_metrics: {
            backup_duration_ms: 0,
            compression_ratio: 0,
            upload_speed_mbps: 0,
          },
          database_snapshot: {
            version: "1.0",
            schema_hash: "",
            total_tables: 1,
            total_records: 10,
          },
        },
      };

      mockStorage.storedBackups.set(
        "backup-1",
        JSON.stringify({ data: "test" }),
      );

      const response = await service.downloadBackup(mockBackup);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });
});
