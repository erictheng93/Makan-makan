/**
 * BackupController Tests
 * 備份控制器測試 — HTTP 請求處理、權限驗證、錯誤回應
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BackupController } from "../BackupController";

// ========================================
// Mock Services
// ========================================

const mockBackupService = {
  createBackup: vi.fn(),
  listBackups: vi.fn(),
  getBackupById: vi.fn(),
  downloadBackup: vi.fn(),
  restoreFromBackup: vi.fn(),
  deleteBackup: vi.fn(),
  getSystemHealth: vi.fn(),
  getRestaurantMetrics: vi.fn(),
  getRestaurantAlerts: vi.fn(),
  getAlertById: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
};

const mockConfigService = {
  getConfigurations: vi.fn(),
  createOrUpdateConfiguration: vi.fn(),
};

const mockValidationService = {
  validateCreateBackupRequest: vi.fn().mockResolvedValue(undefined),
  verifyRestaurantAccess: vi.fn().mockResolvedValue(undefined),
  validateRestoreRequest: vi.fn().mockResolvedValue(undefined),
  validateConfigurationRequest: vi.fn().mockResolvedValue(undefined),
  isValidUUID: vi.fn().mockReturnValue(true),
};

// ========================================
// Hono Context Helper
// ========================================

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";

const createMockContext = (
  overrides: {
    body?: any;
    params?: Record<string, string>;
    query?: Record<string, string>;
    user?: { id: number; role: number };
  } = {},
) => {
  const jsonResponses: any[] = [];
  const context: any = {
    req: {
      json: vi.fn().mockResolvedValue(overrides.body || {}),
      param: vi.fn((key: string) => (overrides.params || {})[key] || ""),
      query: vi.fn((key?: string) => {
        if (key) return (overrides.query || {})[key];
        return overrides.query || {};
      }),
    },
    get: vi.fn((key: string) => {
      if (key === "user") return overrides.user || { id: 1, role: 0 };
      return undefined;
    }),
    json: vi.fn((data: any, status?: number) => {
      jsonResponses.push({ data, status });
      return new Response(JSON.stringify(data), { status: status || 200 });
    }),
    _jsonResponses: jsonResponses,
  };
  return context;
};

// ========================================
// Tests
// ========================================

describe("BackupController", () => {
  let controller: BackupController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new BackupController(
      mockBackupService as never,
      mockConfigService as never,
      mockValidationService as never,
    );
  });

  // ========================================
  // createBackup
  // ========================================

  describe("createBackup - 建立備份", () => {
    it("should create backup and return 201", async () => {
      const body = {
        restaurant_id: VALID_UUID,
        name: "Daily Backup",
        backup_type: "full",
      };
      mockBackupService.createBackup.mockResolvedValue({ backup_id: "new-id" });

      const c = createMockContext({ body, user: { id: 1, role: 0 } });
      await controller.createBackup(c);

      expect(
        mockValidationService.validateCreateBackupRequest,
      ).toHaveBeenCalledOnce();
      expect(mockValidationService.verifyRestaurantAccess).toHaveBeenCalledWith(
        c,
        VALID_UUID,
      );
      expect(mockBackupService.createBackup).toHaveBeenCalledWith(
        expect.objectContaining({ restaurant_id: VALID_UUID }),
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { backup_id: "new-id" },
        }),
        201,
      );
    });

    it("should return 400 when validation fails", async () => {
      mockValidationService.validateCreateBackupRequest.mockRejectedValueOnce(
        new Error("Backup name is required"),
      );

      const c = createMockContext({ body: { restaurant_id: VALID_UUID } });
      await controller.createBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Backup name is required",
        }),
        400,
      );
    });

    it("should return 400 when access denied", async () => {
      mockValidationService.verifyRestaurantAccess.mockRejectedValueOnce(
        new Error("Access denied"),
      );

      const c = createMockContext({
        body: { restaurant_id: VALID_UUID, name: "Test" },
        user: { id: 99, role: 1 },
      });
      await controller.createBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Access denied" }),
        400,
      );
    });
  });

  // ========================================
  // listBackups
  // ========================================

  describe("listBackups - 列出備份", () => {
    it("should return backup list", async () => {
      const mockResult = { items: [], total: 0 };
      mockBackupService.listBackups.mockResolvedValue(mockResult);

      const c = createMockContext({ query: { restaurant_id: VALID_UUID } });
      await controller.listBackups(c);

      expect(
        mockValidationService.verifyRestaurantAccess,
      ).toHaveBeenCalledOnce();
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockResult }),
      );
    });

    it("should return 400 on error", async () => {
      mockBackupService.listBackups.mockRejectedValueOnce(
        new Error("Query failed"),
      );

      const c = createMockContext({ query: { restaurant_id: VALID_UUID } });
      await controller.listBackups(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        400,
      );
    });
  });

  // ========================================
  // getBackup
  // ========================================

  describe("getBackup - 取得單一備份", () => {
    it("should return backup details", async () => {
      const backup = {
        id: VALID_UUID,
        restaurant_id: VALID_UUID,
        name: "Test",
      };
      mockBackupService.getBackupById.mockResolvedValue(backup);

      const c = createMockContext({ params: { id: VALID_UUID } });
      await controller.getBackup(c);

      expect(mockBackupService.getBackupById).toHaveBeenCalledWith(VALID_UUID);
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: backup }),
      );
    });

    it("should return 400 for invalid UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { id: "bad-id" } });
      await controller.getBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Invalid backup ID" }),
        400,
      );
    });

    it("should return 404 when backup not found", async () => {
      mockBackupService.getBackupById.mockResolvedValue(null);

      const c = createMockContext({ params: { id: VALID_UUID } });
      await controller.getBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Backup not found" }),
        404,
      );
    });
  });

  // ========================================
  // downloadBackup
  // ========================================

  describe("downloadBackup - 下載備份", () => {
    it("should return download response for completed backup", async () => {
      const backup = {
        id: VALID_UUID,
        restaurant_id: VALID_UUID,
        status: "completed",
      };
      mockBackupService.getBackupById.mockResolvedValue(backup);
      const downloadResponse = new Response("file-data");
      mockBackupService.downloadBackup.mockResolvedValue(downloadResponse);

      const c = createMockContext({ params: { id: VALID_UUID } });
      const result = await controller.downloadBackup(c);

      expect(result).toBe(downloadResponse);
      expect(mockBackupService.downloadBackup).toHaveBeenCalledWith(backup);
    });

    it("should return 400 for invalid UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { id: "bad" } });
      await controller.downloadBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid backup ID" }),
        400,
      );
    });

    it("should return 404 when backup not found", async () => {
      mockBackupService.getBackupById.mockResolvedValue(null);

      const c = createMockContext({ params: { id: VALID_UUID } });
      await controller.downloadBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Backup not found" }),
        404,
      );
    });

    it("should return 400 when backup is not completed", async () => {
      mockBackupService.getBackupById.mockResolvedValue({
        id: VALID_UUID,
        restaurant_id: VALID_UUID,
        status: "in_progress",
      });

      const c = createMockContext({ params: { id: VALID_UUID } });
      await controller.downloadBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Backup is not completed yet" }),
        400,
      );
    });
  });

  // ========================================
  // restoreBackup
  // ========================================

  describe("restoreBackup - 還原備份", () => {
    it("should initiate restore and return 201", async () => {
      mockBackupService.restoreFromBackup.mockResolvedValue("restore-op-id");
      const body = {
        restaurant_id: VALID_UUID,
        backup_id: VALID_UUID_2,
        restore_type: "full",
        safety_confirmation: {
          confirmation_phrase: "I understand the risks",
          backup_integrity_verified: true,
          data_loss_risk_acknowledged: true,
        },
      };

      const c = createMockContext({
        params: { id: VALID_UUID_2 },
        body,
        user: { id: 1, role: 0 },
      });
      await controller.restoreBackup(c);

      expect(
        mockValidationService.validateRestoreRequest,
      ).toHaveBeenCalledOnce();
      expect(mockBackupService.restoreFromBackup).toHaveBeenCalledWith(
        expect.objectContaining({ backup_id: VALID_UUID_2 }),
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ restore_id: "restore-op-id" }),
        }),
        201,
      );
    });

    it("should return 400 for invalid backup UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { id: "bad" }, body: {} });
      await controller.restoreBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid backup ID" }),
        400,
      );
    });
  });

  // ========================================
  // deleteBackup
  // ========================================

  describe("deleteBackup - 刪除備份", () => {
    it("should delete backup and return success", async () => {
      mockBackupService.getBackupById.mockResolvedValue({
        id: VALID_UUID,
        restaurant_id: VALID_UUID,
      });
      mockBackupService.deleteBackup.mockResolvedValue(undefined);

      const c = createMockContext({
        params: { id: VALID_UUID },
        user: { id: 1, role: 0 },
      });
      await controller.deleteBackup(c);

      expect(mockBackupService.deleteBackup).toHaveBeenCalledWith(
        VALID_UUID,
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Backup deleted successfully",
        }),
      );
    });

    it("should return 404 when backup not found", async () => {
      mockBackupService.getBackupById.mockResolvedValue(null);

      const c = createMockContext({ params: { id: VALID_UUID } });
      await controller.deleteBackup(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Backup not found" }),
        404,
      );
    });
  });

  // ========================================
  // getConfigurations
  // ========================================

  describe("getConfigurations - 取得設定列表", () => {
    it("should return configurations for valid restaurant", async () => {
      const configs = [{ id: "cfg-1", name: "Config 1" }];
      mockConfigService.getConfigurations.mockResolvedValue(configs);

      const c = createMockContext({ params: { restaurant_id: VALID_UUID } });
      await controller.getConfigurations(c);

      expect(mockConfigService.getConfigurations).toHaveBeenCalledWith(
        VALID_UUID,
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: configs }),
      );
    });

    it("should return 400 for invalid restaurant UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { restaurant_id: "bad" } });
      await controller.getConfigurations(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid restaurant ID" }),
        400,
      );
    });
  });

  // ========================================
  // saveConfiguration
  // ========================================

  describe("saveConfiguration - 儲存設定", () => {
    it("should save configuration and return 201", async () => {
      const config = { restaurant_id: VALID_UUID, name: "New Config" };
      const savedConfig = { id: "cfg-new", ...config };
      mockConfigService.createOrUpdateConfiguration.mockResolvedValue(
        savedConfig,
      );

      const c = createMockContext({ body: config, user: { id: 1, role: 0 } });
      await controller.saveConfiguration(c);

      expect(
        mockValidationService.validateConfigurationRequest,
      ).toHaveBeenCalledOnce();
      expect(
        mockConfigService.createOrUpdateConfiguration,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ restaurant_id: VALID_UUID }),
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: savedConfig }),
        201,
      );
    });

    it("should return 400 when validation fails", async () => {
      mockValidationService.validateConfigurationRequest.mockRejectedValueOnce(
        new Error("Configuration name is required"),
      );

      const c = createMockContext({ body: { restaurant_id: VALID_UUID } });
      await controller.saveConfiguration(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Configuration name is required",
        }),
        400,
      );
    });
  });

  // ========================================
  // getSystemHealth
  // ========================================

  describe("getSystemHealth - 系統健康狀態（管理員專用）", () => {
    it("should return health data for admin users", async () => {
      const health = { status: "healthy", backup_count: 42 };
      mockBackupService.getSystemHealth.mockResolvedValue(health);

      const c = createMockContext({ user: { id: 1, role: 0 } });
      await controller.getSystemHealth(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: health }),
      );
    });

    it("should return 403 for non-admin users", async () => {
      const c = createMockContext({ user: { id: 2, role: 1 } });
      await controller.getSystemHealth(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Admin access required",
        }),
        403,
      );
    });

    it("should return 500 on service error", async () => {
      mockBackupService.getSystemHealth.mockRejectedValueOnce(
        new Error("DB down"),
      );

      const c = createMockContext({ user: { id: 1, role: 0 } });
      await controller.getSystemHealth(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        500,
      );
    });
  });

  // ========================================
  // getRestaurantMetrics
  // ========================================

  describe("getRestaurantMetrics - 餐廳備份指標", () => {
    it("should return metrics with default period", async () => {
      const metrics = { total_backups: 10, total_size: 5000 };
      mockBackupService.getRestaurantMetrics.mockResolvedValue(metrics);

      const c = createMockContext({
        params: { restaurant_id: VALID_UUID },
        query: {},
      });
      await controller.getRestaurantMetrics(c);

      expect(mockBackupService.getRestaurantMetrics).toHaveBeenCalledWith(
        VALID_UUID,
        "week",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: metrics }),
      );
    });

    it("should pass custom period", async () => {
      mockBackupService.getRestaurantMetrics.mockResolvedValue({});

      const c = createMockContext({
        params: { restaurant_id: VALID_UUID },
        query: { period: "month" },
      });
      await controller.getRestaurantMetrics(c);

      expect(mockBackupService.getRestaurantMetrics).toHaveBeenCalledWith(
        VALID_UUID,
        "month",
      );
    });

    it("should return 400 for invalid restaurant UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { restaurant_id: "bad" } });
      await controller.getRestaurantMetrics(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid restaurant ID" }),
        400,
      );
    });
  });

  // ========================================
  // getRestaurantAlerts
  // ========================================

  describe("getRestaurantAlerts - 餐廳備份警報", () => {
    it("should return all alerts by default", async () => {
      const alerts = [{ id: "alert-1", type: "backup_failed" }];
      mockBackupService.getRestaurantAlerts.mockResolvedValue(alerts);

      const c = createMockContext({
        params: { restaurant_id: VALID_UUID },
        query: {},
      });
      await controller.getRestaurantAlerts(c);

      expect(mockBackupService.getRestaurantAlerts).toHaveBeenCalledWith(
        VALID_UUID,
        false,
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: alerts }),
      );
    });

    it("should filter unresolved alerts when requested", async () => {
      mockBackupService.getRestaurantAlerts.mockResolvedValue([]);

      const c = createMockContext({
        params: { restaurant_id: VALID_UUID },
        query: { unresolved_only: "true" },
      });
      await controller.getRestaurantAlerts(c);

      expect(mockBackupService.getRestaurantAlerts).toHaveBeenCalledWith(
        VALID_UUID,
        true,
      );
    });

    it("should return 400 for invalid restaurant UUID", async () => {
      mockValidationService.isValidUUID.mockReturnValueOnce(false);

      const c = createMockContext({ params: { restaurant_id: "bad" } });
      await controller.getRestaurantAlerts(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid restaurant ID" }),
        400,
      );
    });
  });

  // ========================================
  // acknowledgeAlert / resolveAlert
  // ========================================

  describe("alert mutations - 備份警報狀態更新", () => {
    it("should acknowledge an alert after verifying restaurant access", async () => {
      const alert = {
        id: "alert-1",
        restaurant_id: VALID_UUID,
        acknowledged: false,
      };
      const acknowledged = { ...alert, acknowledged: true };
      mockBackupService.getAlertById.mockResolvedValue(alert);
      mockBackupService.acknowledgeAlert.mockResolvedValue(acknowledged);

      const c = createMockContext({
        params: { id: "alert-1" },
        user: { id: 1, role: 0 },
      });

      await controller.acknowledgeAlert(c);

      expect(mockValidationService.verifyRestaurantAccess).toHaveBeenCalledWith(
        c,
        VALID_UUID,
      );
      expect(mockBackupService.acknowledgeAlert).toHaveBeenCalledWith(
        "alert-1",
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: acknowledged,
        }),
      );
    });

    it("should resolve an alert after verifying restaurant access", async () => {
      const alert = {
        id: "alert-2",
        restaurant_id: VALID_UUID,
        resolved: false,
      };
      const resolved = { ...alert, resolved: true };
      mockBackupService.getAlertById.mockResolvedValue(alert);
      mockBackupService.resolveAlert.mockResolvedValue(resolved);

      const c = createMockContext({
        params: { id: "alert-2" },
        user: { id: 1, role: 0 },
      });

      await controller.resolveAlert(c);

      expect(mockValidationService.verifyRestaurantAccess).toHaveBeenCalledWith(
        c,
        VALID_UUID,
      );
      expect(mockBackupService.resolveAlert).toHaveBeenCalledWith(
        "alert-2",
        "1",
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: resolved,
        }),
      );
    });

    it("should return 404 when alert is not found", async () => {
      mockBackupService.getAlertById.mockResolvedValue(null);

      const c = createMockContext({ params: { id: "missing-alert" } });
      await controller.acknowledgeAlert(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Alert not found" }),
        404,
      );
      expect(mockBackupService.acknowledgeAlert).not.toHaveBeenCalled();
    });
  });
});
