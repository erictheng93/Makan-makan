import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const db = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  };

  return { db };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

import { BackupService } from "./BackupService";

function createService() {
  const storageService = {
    generateDownloadResponse: vi.fn(),
    deleteBackup: vi.fn(),
    backupExists: vi.fn(),
    retrieveBackup: vi.fn(),
  };
  const configService = {
    getConfigurationById: vi.fn(),
    getDefaultConfiguration: vi.fn(),
  };
  const validationService = {
    validateCreateBackupRequest: vi.fn(),
    checkBackupLimits: vi.fn(),
    checkStorageQuota: vi.fn(),
    validateTableNames: vi.fn(),
    validateRestoreRequest: vi.fn(),
  };
  const service = new BackupService(
    {} as D1Database,
    storageService as any,
    configService as any,
    validationService as any,
  );

  return { service, storageService, configService, validationService };
}

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const deleted: unknown[] = [];

  mocks.db.insert.mockImplementation(() => ({
    values: vi.fn(async (payload: unknown) => {
      inserted.push(payload);
      return payload;
    }),
  }));
  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(async () => undefined),
    };
    return builder;
  });
  mocks.db.delete.mockImplementation((table: unknown) => ({
    where: vi.fn(async () => {
      deleted.push(table);
    }),
  }));

  return { inserted, updated, deleted };
}

describe("BackupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.select.mockReset();
    mocks.db.insert.mockReset();
    mocks.db.update.mockReset();
    mocks.db.delete.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes backup records from camel and snake case database rows", () => {
    const { service } = createService();

    expect(
      (service as any).parseBackupRecord({
        id: "backup-1",
        restaurantId: "restaurant-1",
        configuration_id: "config-1",
        backupType: "full",
        fileSize: 1000,
        compressed_size: 500,
        recordsCount: 20,
        tablesIncluded: ["orders"],
        storageProvider: "r2",
        storage_path: "backups/backup-1.json",
        encryptionEnabled: 1,
        startedAt: "2026-06-07T00:00:00.000Z",
        completed_at: "2026-06-07T00:01:00.000Z",
        errorMessage: null,
        created_by: "user-1",
      }),
    ).toMatchObject({
      id: "backup-1",
      restaurant_id: "restaurant-1",
      configuration_id: "config-1",
      backup_type: "full",
      file_size: 1000,
      compressed_size: 500,
      records_count: 20,
      tables_included: ["orders"],
      storage_provider: "r2",
      storage_path: "backups/backup-1.json",
      encryption_enabled: true,
      started_at: "2026-06-07T00:00:00.000Z",
      completed_at: "2026-06-07T00:01:00.000Z",
      created_by: "user-1",
      metadata: {},
    });
  });

  it("derives manifests from metadata or backup payload row counts", () => {
    const { service } = createService();
    const backup = {
      tables_included: ["orders", "payments"],
      completed_at: "2026-06-07T00:01:00.000Z",
      checksum: "backup-checksum",
    };

    expect(
      (service as any).getManifestFromBackup(
        {
          ...backup,
          metadata: {
            manifest: {
              row_counts: { orders: 2 },
              tables: ["orders"],
              created_at: "2026-06-07T00:00:00.000Z",
              checksum: "manifest-checksum",
            },
          },
        },
        { orders: [{ id: 1 }], payments: [{ id: 2 }] },
      ),
    ).toEqual({
      rowCounts: { orders: 2 },
      tables: ["orders"],
      createdAt: "2026-06-07T00:00:00.000Z",
      checksum: "manifest-checksum",
    });
    expect(
      (service as any).getManifestFromBackup(
        { ...backup, metadata: {} },
        { orders: [{ id: 1 }, { id: 2 }], payments: [] },
      ),
    ).toEqual({
      rowCounts: { orders: 2, payments: 0 },
      tables: ["orders", "payments"],
      createdAt: "2026-06-07T00:01:00.000Z",
      checksum: "backup-checksum",
    });
  });

  it("parses alert details, titles, summaries, and optional fields", () => {
    const { service } = createService();

    expect(
      (service as any).parseBackupAlerts([
        {
          id: "alert-1",
          restaurantId: "restaurant-1",
          alertType: "backup_failed",
          severity: "critical",
          message: "Backup failed",
          details: JSON.stringify({
            title: "Custom failure",
            related_backup_id: "backup-1",
          }),
          triggeredAt: "2026-06-07T00:00:00.000Z",
          acknowledged: 1,
          acknowledgedBy: "user-1",
          resolved: 0,
        },
        {
          id: "alert-2",
          restaurant_id: "restaurant-1",
          alert_type: "storage_quota_exceeded",
          severity: "high",
          message: "Quota exceeded",
          details: "not json",
          triggered_at: "2026-06-07T01:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: "alert-1",
        restaurant_id: "restaurant-1",
        alert_type: "backup_failed",
        severity: "critical",
        title: "Custom failure",
        message: "Backup failed",
        related_backup_id: "backup-1",
        triggered_at: "2026-06-07T00:00:00.000Z",
        acknowledged: true,
        acknowledged_by: "user-1",
        acknowledged_at: undefined,
        resolved: false,
        resolved_at: undefined,
      },
      {
        id: "alert-2",
        restaurant_id: "restaurant-1",
        alert_type: "storage_quota_exceeded",
        severity: "high",
        title: "Storage Quota Exceeded",
        message: "Quota exceeded",
        related_backup_id: undefined,
        triggered_at: "2026-06-07T01:00:00.000Z",
        acknowledged: false,
        acknowledged_by: undefined,
        acknowledged_at: undefined,
        resolved: false,
        resolved_at: undefined,
      },
    ]);
    expect(
      (service as any).buildAlertSummary([
        { severity: "critical", total: 2 },
        { severity: "high" },
        { severity: "unknown", total: 10 },
      ]),
    ).toEqual({ critical: 2, high: 1, medium: 0, low: 0 });
  });

  it("guards SQL identifiers and converts values for D1 bindings", () => {
    const { service } = createService();

    expect(() =>
      (service as any).assertSafeIdentifier("orders_2026"),
    ).not.toThrow();
    expect(() => (service as any).assertSafeIdentifier("orders;drop")).toThrow(
      "Unsafe SQL identifier: orders;drop",
    );
    expect((service as any).resolvePhysicalTableName("menus")).toBe(
      "menu_items",
    );
    expect((service as any).resolvePhysicalTableName("orders")).toBe("orders");
    expect((service as any).toD1Value(undefined)).toBeNull();
    expect((service as any).toD1Value(false)).toBe(0);
    expect((service as any).toD1Value(true)).toBe(1);
    expect((service as any).toD1Value(42)).toBe(42);
    expect((service as any).toD1Value({ nested: true })).toBe(
      JSON.stringify({ nested: true }),
    );
  });

  it("downloads backups through storage and wraps storage failures", async () => {
    const { service, storageService } = createService();
    const response = new Response("backup data");
    storageService.generateDownloadResponse.mockResolvedValue(response);

    await expect(service.downloadBackup({ id: "backup-1" } as any)).resolves
      .toBe(response);

    storageService.generateDownloadResponse.mockRejectedValue(
      new Error("storage offline"),
    );
    await expect(service.downloadBackup({ id: "backup-1" } as any)).rejects
      .toThrow("Failed to download backup");
  });

  it("writes audit logs with request context fallbacks", async () => {
    const { service } = createService();
    const values = vi.fn();
    mocks.db.insert.mockReturnValue({ values });
    service.setRequestContext({
      ipAddress: "203.0.113.10",
      userAgent: "Vitest",
    });

    await (service as any).createAuditLog({
      restaurant_id: "restaurant-1",
      action: "backup_deleted",
      details: { backup_id: "backup-1" },
      performed_by: "user-1",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        action: "backup_deleted",
        details: { backup_id: "backup-1" },
        performedBy: "user-1",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest",
        timestamp: expect.any(String),
      }),
    );
  });

  it("lists and fetches backups with parsed records and total counts", async () => {
    const { service } = createService();
    const backupRow = {
      id: "backup-1",
      restaurantId: "restaurant-1",
      configurationId: "config-1",
      backupType: "full",
      status: "completed",
      fileSize: 2048,
      compressedSize: 1024,
      recordsCount: 12,
      tablesIncluded: ["orders"],
      storageProvider: "r2",
      storagePath: "backups/backup-1.json",
      encryptionEnabled: true,
      startedAt: "2026-06-07T00:00:00.000Z",
      completedAt: "2026-06-07T00:01:00.000Z",
      createdBy: "user-1",
      metadata: { manifest: { tables: ["orders"] } },
    };
    mockSelectResults([[backupRow], [{ total: 1 }], [backupRow]]);

    await expect(
      service.listBackups({
        restaurant_id: "restaurant-1",
        status: "completed",
        backup_type: "full",
        date_from: "2026-06-01T00:00:00.000Z",
        date_to: "2026-06-08T00:00:00.000Z",
        page: 2,
        limit: 5,
        sort_by: "file_size",
        sort_order: "asc",
      }),
    ).resolves.toMatchObject({
      total: 1,
      backups: [
        {
          id: "backup-1",
          restaurant_id: "restaurant-1",
          backup_type: "full",
          file_size: 2048,
          storage_path: "backups/backup-1.json",
        },
      ],
    });
    await expect(service.getBackupById("backup-1")).resolves.toMatchObject({
      id: "backup-1",
      restaurant_id: "restaurant-1",
    });
    expect(mocks.db.select).toHaveBeenCalledTimes(3);
  });

  it("deletes backups from storage, database, and audit log", async () => {
    const { service, storageService } = createService();
    const mutations = mockMutations();
    mockSelectResults([
      [
        {
          id: "backup-1",
          restaurantId: "restaurant-1",
          name: "Nightly backup",
          tablesIncluded: ["orders"],
          storageProvider: "r2",
          storagePath: "backup.json",
          encryptionEnabled: false,
        },
      ],
    ]);

    await expect(service.deleteBackup("backup-1", "user-1")).resolves
      .toBeUndefined();
    expect(storageService.deleteBackup).toHaveBeenCalledWith(
      expect.objectContaining({ id: "backup-1", restaurant_id: "restaurant-1" }),
    );
    expect(mutations.deleted).toHaveLength(1);
    expect(mutations.inserted[0]).toMatchObject({
      restaurantId: "restaurant-1",
      action: "backup_deleted",
      performedBy: "user-1",
      details: {
        backup_id: "backup-1",
        backup_name: "Nightly backup",
      },
    });
  });

  it("reports system health and restaurant metrics from aggregate rows", async () => {
    const { service } = createService();
    mockSelectResults([
      [
        {
          totalRestaurants: 3,
          totalBackups: 20,
          runningBackups: 2,
          failedBackups24h: 6,
          avgSize: 2048,
          avgDurationMs: 180000,
          avgCompressionRatio: 2.5,
        },
      ],
      [{ totalBytes: 4096, totalFiles: 2 }],
      [{ total: 4 }],
      [{ severity: "critical" }, { severity: "high" }],
      [
        {
          total_backups: 5,
          successful_backups: 4,
          failed_backups: 1,
          avg_backup_size: 1024,
          total_storage_used: 5120,
        },
      ],
    ]);

    await expect(service.getSystemHealth()).resolves.toEqual({
      overall_status: "warning",
      total_restaurants: 3,
      active_configurations: 4,
      running_backups: 2,
      failed_backups_24h: 6,
      storage_usage: {
        total_bytes: 4096,
        available_bytes: 0,
        usage_percentage: 0,
      },
      performance_metrics: {
        average_backup_duration_minutes: 3,
        average_success_rate_percentage: 70,
        average_compression_ratio: 2.5,
      },
      alerts_summary: { critical: 1, high: 1, medium: 0, low: 0 },
    });
    await expect(
      service.getRestaurantMetrics("restaurant-1", "month"),
    ).resolves.toEqual({
      total_backups: 5,
      successful_backups: 4,
      failed_backups: 1,
      avg_backup_size: 1024,
      total_storage_used: 5120,
    });
  });

  it("lists, acknowledges, and resolves backup alerts with audit records", async () => {
    const { service } = createService();
    const mutations = mockMutations();
    const alertRow = {
      id: "alert-1",
      restaurantId: "restaurant-1",
      alertType: "backup_failed",
      severity: "critical",
      message: "Backup failed",
      details: { title: "Failed backup", related_backup_id: "backup-1" },
      triggeredAt: "2026-06-07T00:00:00.000Z",
      acknowledged: false,
      resolved: false,
    };
    mockSelectResults([[alertRow], [alertRow], [alertRow], [alertRow]]);

    await expect(
      service.getRestaurantAlerts("restaurant-1", true),
    ).resolves.toMatchObject([
      {
        id: "alert-1",
        title: "Failed backup",
        related_backup_id: "backup-1",
      },
    ]);
    await expect(service.getAlertById("alert-1")).resolves.toMatchObject({
      id: "alert-1",
      restaurant_id: "restaurant-1",
    });
    await expect(service.acknowledgeAlert("alert-1", "user-1")).resolves
      .toMatchObject({
        id: "alert-1",
        acknowledged: true,
        acknowledged_by: "user-1",
      });
    await expect(service.resolveAlert("alert-1", "user-2")).resolves
      .toMatchObject({
        id: "alert-1",
        resolved: true,
      });

    expect(mutations.updated).toEqual([
      { acknowledged: true },
      expect.objectContaining({ resolved: true }),
    ]);
    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        action: "backup_alert_acknowledged",
        performedBy: "user-1",
      }),
      expect.objectContaining({
        action: "backup_alert_resolved",
        performedBy: "user-2",
      }),
    ]);
  });
});
