/**
 * BackupConfigService Tests
 * 備份設定管理服務測試
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BackupConfigService } from "../BackupConfigService";
import type { BackupConfiguration } from "@makanmakan/shared-types";

// ========================================
// Mock Drizzle ORM
// ========================================

let selectResults: any[] = [];
let countResult = 0;

const {
  mockSelectChain,
  mockInsertChain,
  mockUpdateChain,
  mockDeleteChain,
  mockDrizzleDb,
} = vi.hoisted(() => {
  const mockSelectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  mockSelectChain.then = (resolve: any, reject: any) =>
    Promise.resolve([]).then(resolve, reject);

  const mockInsertChain: any = {
    values: vi.fn().mockReturnThis(),
  };
  mockInsertChain.then = (resolve: any) =>
    Promise.resolve({ meta: { changes: 1 } }).then(resolve);

  const mockUpdateChain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  };
  mockUpdateChain.then = (resolve: any) =>
    Promise.resolve({ meta: { changes: 1 } }).then(resolve);

  const mockDeleteChain: any = {
    where: vi.fn().mockReturnThis(),
  };
  mockDeleteChain.then = (resolve: any) =>
    Promise.resolve({ meta: { changes: 1 } }).then(resolve);

  const mockDrizzleDb = {
    select: vi.fn().mockReturnValue(mockSelectChain),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    delete: vi.fn().mockReturnValue(mockDeleteChain),
    run: vi.fn(),
  };

  return {
    mockSelectChain,
    mockInsertChain,
    mockUpdateChain,
    mockDeleteChain,
    mockDrizzleDb,
  };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn().mockReturnValue(mockDrizzleDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  count: vi.fn(() => "count"),
  isNotNull: vi.fn((col: any) => col),
  desc: vi.fn((col: any) => col),
}));

vi.mock("@makanmakan/database", () => ({
  backupConfigurations: {
    id: "id",
    restaurantId: "restaurantId",
    name: "name",
    scheduleEnabled: "scheduleEnabled",
    scheduleCron: "scheduleCron",
    createdAt: "createdAt",
  },
  backupRecords: {
    configurationId: "configurationId",
  },
}));

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  ...(globalThis as any).crypto,
  randomUUID: vi.fn().mockReturnValue("mock-uuid-1234"),
});

// ========================================
// Test Helpers
// ========================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const buildConfig = (
  overrides: Partial<BackupConfiguration> = {},
): BackupConfiguration => ({
  id: VALID_UUID,
  restaurant_id: VALID_UUID,
  name: "Test Configuration",
  description: "Test description",
  backup_type: "full",
  schedule_enabled: false,
  retention_days: 30,
  include_tables: ["orders", "menu_items"],
  exclude_tables: [],
  compression_enabled: true,
  encryption_enabled: false,
  storage_provider: "r2",
  max_parallel_backups: 1,
  notifications_enabled: false,
  notification_channels: [],
  created_by: "user-1",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const buildDbRow = (overrides: any = {}) => ({
  id: VALID_UUID,
  restaurantId: VALID_UUID,
  name: "Test Configuration",
  description: "Test description",
  backupType: "full",
  scheduleEnabled: false,
  scheduleCron: null,
  retentionDays: 30,
  includeTables: ["orders", "menu_items"],
  excludeTables: [],
  compressionEnabled: true,
  encryptionEnabled: false,
  storageProvider: "r2",
  maxParallelBackups: 1,
  notificationsEnabled: false,
  notificationChannels: [],
  createdBy: "user-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

// ========================================
// Tests
// ========================================

describe("BackupConfigService", () => {
  let service: BackupConfigService;
  const mockD1 = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    countResult = 0;
    service = new BackupConfigService(mockD1);

    // Reset thenable for select
    mockSelectChain.then = (resolve: any, reject: any) =>
      Promise.resolve(selectResults).then(resolve, reject);
  });

  // ========================================
  // getConfigurations
  // ========================================

  describe("getConfigurations - 取得餐廳設定列表", () => {
    it("should return configurations for a restaurant", async () => {
      selectResults = [
        buildDbRow(),
        buildDbRow({ id: "id-2", name: "Config 2" }),
      ];
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve(selectResults).then(resolve);

      const result = await service.getConfigurations(VALID_UUID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          restaurant_id: VALID_UUID,
          name: "Test Configuration",
        }),
      );
      expect(mockDrizzleDb.select).toHaveBeenCalledOnce();
    });

    it("should return empty array when no configurations exist", async () => {
      selectResults = [];
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([]).then(resolve);

      const result = await service.getConfigurations(VALID_UUID);
      expect(result).toEqual([]);
    });

    it("should throw a user-safe error on DB failure", async () => {
      mockSelectChain.then = (_: any, reject: any) =>
        Promise.reject(new Error("DB connection lost")).then(_, reject);

      await expect(service.getConfigurations(VALID_UUID)).rejects.toThrow(
        "Failed to fetch backup configurations",
      );
    });
  });

  // ========================================
  // getConfigurationById
  // ========================================

  describe("getConfigurationById - 透過 ID 取得設定", () => {
    it("should return a configuration when found", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow()]).then(resolve);

      const result = await service.getConfigurationById(VALID_UUID);

      expect(result).toEqual(
        expect.objectContaining({
          id: VALID_UUID,
          name: "Test Configuration",
        }),
      );
    });

    it("should return null when not found", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([]).then(resolve);

      const result = await service.getConfigurationById("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ========================================
  // getDefaultConfiguration
  // ========================================

  describe("getDefaultConfiguration - 取得預設設定", () => {
    it("should return existing default configuration", async () => {
      const defaultRow = buildDbRow({ name: "Default Configuration" });
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([defaultRow]).then(resolve);

      const result = await service.getDefaultConfiguration(VALID_UUID);

      expect(result).toEqual(
        expect.objectContaining({
          name: "Default Configuration",
        }),
      );
    });

    it("should create and return a default configuration if none exists", async () => {
      // First select returns empty (no default), then insert succeeds
      let selectCallCount = 0;
      mockSelectChain.then = (resolve: any) => {
        selectCallCount++;
        return Promise.resolve(selectCallCount === 1 ? [] : []).then(resolve);
      };

      const result = await service.getDefaultConfiguration(VALID_UUID);

      expect(result).toEqual(
        expect.objectContaining({
          name: "Default Configuration",
          restaurant_id: VALID_UUID,
          backup_type: "full",
          retention_days: 30,
          compression_enabled: true,
        }),
      );
      expect(mockDrizzleDb.insert).toHaveBeenCalledOnce();
    });
  });

  // ========================================
  // createConfiguration
  // ========================================

  describe("createConfiguration - 建立設定", () => {
    it("should insert and return the configuration", async () => {
      const config = buildConfig();

      const result = await service.createConfiguration(config);

      expect(result).toEqual(config);
      expect(mockDrizzleDb.insert).toHaveBeenCalledOnce();
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: config.id,
          restaurantId: config.restaurant_id,
          name: config.name,
        }),
      );
    });

    it("should throw on insert failure", async () => {
      mockInsertChain.then = (_: any, reject: any) =>
        Promise.reject(new Error("Insert failed")).then(_, reject);

      await expect(service.createConfiguration(buildConfig())).rejects.toThrow(
        "Failed to create backup configuration",
      );

      // Reset
      mockInsertChain.then = (resolve: any) =>
        Promise.resolve({ meta: { changes: 1 } }).then(resolve);
    });
  });

  // ========================================
  // updateConfiguration
  // ========================================

  describe("updateConfiguration - 更新設定", () => {
    it("should update an existing configuration", async () => {
      // getConfigurationById returns existing config
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow()]).then(resolve);

      const result = await service.updateConfiguration(VALID_UUID, {
        name: "Updated Name",
      });

      expect(result).toEqual(
        expect.objectContaining({
          name: "Updated Name",
        }),
      );
      expect(mockDrizzleDb.update).toHaveBeenCalledOnce();
      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Name",
        }),
      );
    });

    it("should throw when configuration not found", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([]).then(resolve);

      await expect(
        service.updateConfiguration("missing-id", { name: "New" }),
      ).rejects.toThrow();
    });

    it("should reject updates when the payload restaurant does not match", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow({ restaurantId: VALID_UUID })]).then(
          resolve,
        );

      await expect(
        service.updateConfiguration(VALID_UUID, {
          restaurant_id: "550e8400-e29b-41d4-a716-446655440099",
          name: "Cross Tenant Update",
        }),
      ).rejects.toThrow("Failed to update backup configuration");

      expect(mockDrizzleDb.update).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // createOrUpdateConfiguration
  // ========================================

  describe("createOrUpdateConfiguration - 建立或更新設定", () => {
    it("should create a new config when no id is provided", async () => {
      const result = await service.createOrUpdateConfiguration(
        { restaurant_id: VALID_UUID, name: "New Config" },
        "user-1",
      );

      expect(result).toEqual(
        expect.objectContaining({
          restaurant_id: VALID_UUID,
          name: "New Config",
          created_by: "user-1",
        }),
      );
      expect(mockDrizzleDb.insert).toHaveBeenCalledOnce();
    });

    it("should update existing config when id is provided", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow()]).then(resolve);

      const result = await service.createOrUpdateConfiguration(
        { id: VALID_UUID, restaurant_id: VALID_UUID, name: "Updated" },
        "user-1",
      );

      expect(result).toEqual(expect.objectContaining({ name: "Updated" }));
      expect(mockDrizzleDb.update).toHaveBeenCalledOnce();
    });

    it("should not update a config owned by another restaurant", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow({ restaurantId: VALID_UUID })]).then(
          resolve,
        );

      await expect(
        service.createOrUpdateConfiguration(
          {
            id: VALID_UUID,
            restaurant_id: "550e8400-e29b-41d4-a716-446655440099",
            name: "Cross Tenant Update",
          },
          "user-1",
        ),
      ).rejects.toThrow("Failed to save backup configuration");

      expect(mockDrizzleDb.update).not.toHaveBeenCalled();
    });

    it("should default compression_enabled to true", async () => {
      const result = await service.createOrUpdateConfiguration(
        { restaurant_id: VALID_UUID, name: "Defaults" },
        "user-1",
      );

      expect(result.compression_enabled).toBe(true);
    });
  });

  // ========================================
  // deleteConfiguration
  // ========================================

  describe("deleteConfiguration - 刪除設定", () => {
    it("should delete a configuration not in use", async () => {
      // Usage count = 0
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([{ total: 0 }]).then(resolve);

      await expect(
        service.deleteConfiguration(VALID_UUID),
      ).resolves.toBeUndefined();

      expect(mockDrizzleDb.delete).toHaveBeenCalledOnce();
    });

    it("should prevent deletion when configuration is in use", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([{ total: 5 }]).then(resolve);

      await expect(service.deleteConfiguration(VALID_UUID)).rejects.toThrow(
        "Failed to delete backup configuration",
      );
    });
  });

  // ========================================
  // getScheduledConfigurations
  // ========================================

  describe("getScheduledConfigurations - 取得排程設定", () => {
    it("should return configs with active schedules", async () => {
      const scheduled = buildDbRow({
        scheduleEnabled: true,
        scheduleCron: "0 2 * * *",
      });
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([scheduled]).then(resolve);

      const result = await service.getScheduledConfigurations();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          schedule_enabled: true,
        }),
      );
    });
  });

  // ========================================
  // validateConfigurationCompatibility
  // ========================================

  describe("validateConfigurationCompatibility - 設定相容性驗證", () => {
    it("should reject external storage provider", async () => {
      const config = buildConfig({ storage_provider: "external" });

      await expect(
        service.validateConfigurationCompatibility(config),
      ).rejects.toThrow("External storage provider is not currently supported");
    });

    it("should reject overlapping include and exclude tables", async () => {
      const config = buildConfig({
        include_tables: ["orders", "menu_items"],
        exclude_tables: ["orders"],
      });

      await expect(
        service.validateConfigurationCompatibility(config),
      ).rejects.toThrow("Tables cannot be both included and excluded: orders");
    });

    it("should reject schedule enabled without cron expression", async () => {
      const config = buildConfig({
        schedule_enabled: true,
        schedule_cron: undefined,
      });

      await expect(
        service.validateConfigurationCompatibility(config),
      ).rejects.toThrow("Schedule is enabled but no cron expression provided");
    });

    it("should reject notifications enabled without channels", async () => {
      const config = buildConfig({
        notifications_enabled: true,
        notification_channels: [],
      });

      await expect(
        service.validateConfigurationCompatibility(config),
      ).rejects.toThrow(
        "Notifications are enabled but no notification channels specified",
      );
    });

    it("should pass for a valid r2 configuration", async () => {
      const config = buildConfig();

      await expect(
        service.validateConfigurationCompatibility(config),
      ).resolves.toBeUndefined();
    });
  });

  // ========================================
  // cloneConfiguration
  // ========================================

  describe("cloneConfiguration - 複製設定", () => {
    it("should clone a configuration to another restaurant", async () => {
      const targetRestaurant = "550e8400-e29b-41d4-a716-446655440099";

      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([buildDbRow()]).then(resolve);

      const result = await service.cloneConfiguration(
        VALID_UUID,
        targetRestaurant,
        "user-2",
      );

      expect(result).toEqual(
        expect.objectContaining({
          restaurant_id: targetRestaurant,
          name: "Test Configuration (Copy)",
          created_by: "user-2",
        }),
      );
      expect(mockDrizzleDb.insert).toHaveBeenCalledOnce();
    });

    it("should throw when source configuration not found", async () => {
      mockSelectChain.then = (resolve: any) =>
        Promise.resolve([]).then(resolve);

      await expect(
        service.cloneConfiguration("missing", "target", "user"),
      ).rejects.toThrow("Failed to clone backup configuration");
    });
  });
});
