import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";
import { BackupController } from "./BackupController";

const uuid = "550e8400-e29b-41d4-a716-446655440000";
const restaurantId = "660e8400-e29b-41d4-a716-446655440000";

function createContext(options: {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  user?: AuthUser;
} = {}) {
  const user = options.user ?? { id: "user-7", username: "owner", role: 1, restaurantId };
  const req = {
    json: vi.fn(async () => options.body),
    param: vi.fn((key: string) => options.params?.[key]),
    query: vi.fn((key?: string) =>
      key === undefined ? (options.query ?? {}) : options.query?.[key],
    ),
  };

  return {
    req,
    env: { DB: {}, CACHE_KV: {} },
    get: vi.fn((key: string) => (key === "user" ? user : undefined)),
    json: vi.fn((body: unknown, status = 200) =>
      Response.json(body, { status }),
    ),
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("BackupController", () => {
  const backupService = {
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
  const configService = {
    getConfigurations: vi.fn(),
    createOrUpdateConfiguration: vi.fn(),
  };
  const validationService = {
    validateCreateBackupRequest: vi.fn(),
    verifyRestaurantAccess: vi.fn(),
    isValidUUID: vi.fn(),
    validateRestoreRequest: vi.fn(),
    validateConfigurationRequest: vi.fn(),
  };

  let controller: BackupController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    controller = new BackupController(
      backupService as never,
      configService as never,
      validationService as never,
    );

    validationService.isValidUUID.mockReturnValue(true);
    validationService.validateCreateBackupRequest.mockResolvedValue(undefined);
    validationService.verifyRestaurantAccess.mockResolvedValue(undefined);
    validationService.validateRestoreRequest.mockResolvedValue(undefined);
    validationService.validateConfigurationRequest.mockResolvedValue(undefined);
    backupService.createBackup.mockResolvedValue({ id: uuid });
    backupService.listBackups.mockResolvedValue({ data: [{ id: uuid }] });
    backupService.getBackupById.mockResolvedValue({
      id: uuid,
      restaurant_id: restaurantId,
      status: "completed",
    });
    backupService.downloadBackup.mockResolvedValue(
      new Response("backup-data", {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    backupService.restoreFromBackup.mockResolvedValue("restore-1");
    backupService.deleteBackup.mockResolvedValue(undefined);
    backupService.getSystemHealth.mockResolvedValue({ status: "healthy" });
    backupService.getRestaurantMetrics.mockResolvedValue({ successful: 3 });
    backupService.getRestaurantAlerts.mockResolvedValue([{ id: "alert-1" }]);
    backupService.getAlertById.mockResolvedValue({
      id: "alert-1",
      restaurant_id: restaurantId,
    });
    backupService.acknowledgeAlert.mockResolvedValue({ id: "alert-1" });
    backupService.resolveAlert.mockResolvedValue({ id: "alert-1" });
    configService.getConfigurations.mockResolvedValue([{ id: "config-1" }]);
    configService.createOrUpdateConfiguration.mockResolvedValue({
      id: "config-1",
    });
  });

  it("creates backups after validation and restaurant access checks", async () => {
    const body = { restaurant_id: restaurantId, type: "full" };
    const response = await controller.createBackup(
      createContext({ body }) as never,
    );

    expect(response.status).toBe(201);
    await expect(readJson(response)).resolves.toMatchObject({
      success: true,
      data: { id: uuid },
    });
    expect(validationService.validateCreateBackupRequest).toHaveBeenCalledWith(
      body,
    );
    expect(validationService.verifyRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
    );
    expect(backupService.createBackup).toHaveBeenCalledWith(body, "user-7");

    validationService.validateCreateBackupRequest.mockRejectedValueOnce(
      new Error("invalid request"),
    );
    const failed = await controller.createBackup(
      createContext({ body }) as never,
    );

    expect(failed.status).toBe(400);
    await expect(readJson(failed)).resolves.toMatchObject({
      success: false,
      error: { code: "BACKUP_OPERATION_FAILED", message: "invalid request" },
    });
  });

  it("lists backups with query filters after access validation", async () => {
    const query = { restaurant_id: restaurantId, page: "2" };
    const response = await controller.listBackups(
      createContext({ query }) as never,
    );

    expect(response.status).toBe(200);
    expect(validationService.verifyRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
    );
    expect(backupService.listBackups).toHaveBeenCalledWith(query);
  });

  it("returns backup details with invalid id, missing backup, success, and access failure branches", async () => {
    validationService.isValidUUID.mockReturnValueOnce(false);

    let response = await controller.getBackup(
      createContext({ params: { id: "bad" } }) as never,
    );
    expect(response.status).toBe(400);

    backupService.getBackupById.mockResolvedValueOnce(null);
    response = await controller.getBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(404);

    response = await controller.getBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(200);
    expect(backupService.getBackupById).toHaveBeenCalledWith(uuid);

    validationService.verifyRestaurantAccess.mockRejectedValueOnce(
      new Error("denied"),
    );
    response = await controller.getBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("downloads only completed backups and returns service download responses", async () => {
    let response = await controller.downloadBackup(
      createContext({ params: { id: uuid } }) as never,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("backup-data");
    expect(backupService.downloadBackup).toHaveBeenCalledWith(
      expect.objectContaining({ id: uuid }),
    );

    backupService.getBackupById.mockResolvedValueOnce({
      id: uuid,
      restaurant_id: restaurantId,
      status: "running",
    });
    response = await controller.downloadBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(400);

    backupService.downloadBackup.mockRejectedValueOnce(new Error("r2 down"));
    response = await controller.downloadBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(500);
  });

  it("restores backups and normalizes string or verified restore results", async () => {
    const body = { restaurant_id: restaurantId, backup_id: "old" };

    let response = await controller.restoreBackup(
      createContext({ params: { id: uuid }, body }) as never,
    );

    expect(response.status).toBe(201);
    await expect(readJson(response)).resolves.toMatchObject({
      success: true,
      data: {
        restore_id: "restore-1",
        message: "Restore operation initiated successfully",
      },
    });
    expect(backupService.restoreFromBackup).toHaveBeenCalledWith(
      { restaurant_id: restaurantId, backup_id: uuid },
      "user-7",
    );

    backupService.restoreFromBackup.mockResolvedValueOnce({
      restore_id: "restore-2",
      checksum: "sha256",
      rowCounts: { orders: 2 },
    });
    response = await controller.restoreBackup(
      createContext({ params: { id: uuid }, body }) as never,
    );

    expect(response.status).toBe(201);
    await expect(readJson(response)).resolves.toMatchObject({
      data: {
        restore_id: "restore-2",
        checksum: "sha256",
        rowCounts: { orders: 2 },
      },
    });

    validationService.isValidUUID.mockReturnValueOnce(false);
    response = await controller.restoreBackup(
      createContext({ params: { id: "bad" }, body }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("deletes backups after lookup and restaurant access validation", async () => {
    let response = await controller.deleteBackup(
      createContext({ params: { id: uuid } }) as never,
    );

    expect(response.status).toBe(200);
    expect(backupService.deleteBackup).toHaveBeenCalledWith(uuid, "user-7");

    backupService.getBackupById.mockResolvedValueOnce(null);
    response = await controller.deleteBackup(
      createContext({ params: { id: uuid } }) as never,
    );
    expect(response.status).toBe(404);

    validationService.isValidUUID.mockReturnValueOnce(false);
    response = await controller.deleteBackup(
      createContext({ params: { id: "bad" } }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("gets and saves backup configurations with restaurant validation", async () => {
    let response = await controller.getConfigurations(
      createContext({ params: { restaurant_id: restaurantId } }) as never,
    );

    expect(response.status).toBe(200);
    expect(configService.getConfigurations).toHaveBeenCalledWith(restaurantId);

    const config = { restaurant_id: restaurantId, enabled: true };
    response = await controller.saveConfiguration(
      createContext({ body: config }) as never,
    );
    expect(response.status).toBe(201);
    expect(validationService.validateConfigurationRequest).toHaveBeenCalledWith(
      config,
    );
    expect(configService.createOrUpdateConfiguration).toHaveBeenCalledWith(
      config,
      "user-7",
    );

    validationService.isValidUUID.mockReturnValueOnce(false);
    response = await controller.getConfigurations(
      createContext({ params: { restaurant_id: "bad" } }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("returns system health only for admins and maps service failures", async () => {
    let response = await controller.getSystemHealth(
      createContext({ user: { id: "user-7", username: "owner", role: 1, restaurantId } }) as never,
    );
    expect(response.status).toBe(403);

    response = await controller.getSystemHealth(
      createContext({ user: { id: "user-1", username: "admin", role: 0 } }) as never,
    );
    expect(response.status).toBe(200);
    expect(backupService.getSystemHealth).toHaveBeenCalled();

    backupService.getSystemHealth.mockRejectedValueOnce(new Error("down"));
    response = await controller.getSystemHealth(
      createContext({ user: { id: "user-1", username: "admin", role: 0 } }) as never,
    );
    expect(response.status).toBe(500);
  });

  it("returns restaurant metrics and alerts with query normalization", async () => {
    let response = await controller.getRestaurantMetrics(
      createContext({
        params: { restaurant_id: restaurantId },
        query: { period: "month" },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(backupService.getRestaurantMetrics).toHaveBeenCalledWith(
      restaurantId,
      "month",
    );

    response = await controller.getRestaurantAlerts(
      createContext({
        params: { restaurant_id: restaurantId },
        query: { unresolved_only: "true" },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(backupService.getRestaurantAlerts).toHaveBeenCalledWith(
      restaurantId,
      true,
    );

    validationService.isValidUUID.mockReturnValueOnce(false);
    response = await controller.getRestaurantMetrics(
      createContext({ params: { restaurant_id: "bad" } }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("acknowledges and resolves alerts after alert lookup and restaurant access checks", async () => {
    let response = await controller.acknowledgeAlert(
      createContext({ params: { id: "alert-1" } }) as never,
    );

    expect(response.status).toBe(200);
    expect(backupService.getAlertById).toHaveBeenCalledWith("alert-1");
    expect(backupService.acknowledgeAlert).toHaveBeenCalledWith("alert-1", "user-7");

    response = await controller.resolveAlert(
      createContext({ params: { id: "alert-1" } }) as never,
    );
    expect(response.status).toBe(200);
    expect(backupService.resolveAlert).toHaveBeenCalledWith("alert-1", "user-7");

    backupService.getAlertById.mockResolvedValueOnce(null);
    response = await controller.acknowledgeAlert(
      createContext({ params: { id: "missing" } }) as never,
    );
    expect(response.status).toBe(404);

    response = await controller.resolveAlert(
      createContext({ params: {} }) as never,
    );
    expect(response.status).toBe(400);
  });
});
