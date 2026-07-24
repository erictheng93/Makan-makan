import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupConfiguration } from "@makanmakan/shared-types";

const drizzleState = vi.hoisted(() => ({
  db: undefined as unknown,
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => drizzleState.db),
}));

import { BackupConfigService } from "./BackupConfigService";

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createDb(options: { selectResults?: unknown[] } = {}) {
  const selectResults = [...(options.selectResults ?? [])];
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const deleted: unknown[] = [];

  const db = {
    inserted,
    updated,
    deleted,
    select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(async (payload: unknown) => {
        inserted.push(payload);
        return payload;
      }),
    })),
    update: vi.fn(() => {
      const builder = {
        set: vi.fn((payload: unknown) => {
          updated.push(payload);
          return builder;
        }),
        where: vi.fn(async () => undefined),
      };
      return builder;
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        deleted.push(true);
      }),
    })),
  };

  return db;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "config-1",
    restaurantId: "restaurant-1",
    name: "Nightly",
    description: "Nightly backup",
    backupType: "incremental",
    scheduleEnabled: 1,
    scheduleCron: "0 2 * * *",
    retentionDays: 14,
    includeTables: ["orders"],
    excludeTables: ["audit_logs"],
    compressionEnabled: 1,
    encryptionEnabled: 0,
    storageProvider: "r2",
    maxParallelBackups: 2,
    notificationsEnabled: 1,
    notificationChannels: ["email"],
    createdBy: "user-1",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T01:00:00.000Z",
    ...overrides,
  };
}

function config(overrides: Partial<BackupConfiguration> = {}) {
  return {
    id: "config-1",
    restaurant_id: "restaurant-1",
    name: "Nightly",
    description: "Nightly backup",
    backup_type: "incremental",
    schedule_enabled: true,
    schedule_cron: "0 2 * * *",
    retention_days: 14,
    include_tables: ["orders"],
    exclude_tables: ["audit_logs"],
    compression_enabled: true,
    encryption_enabled: false,
    storage_provider: "r2",
    max_parallel_backups: 2,
    notifications_enabled: true,
    notification_channels: ["email"],
    created_by: "user-1",
    created_at: "2026-06-07T00:00:00.000Z",
    updated_at: "2026-06-07T01:00:00.000Z",
    ...overrides,
  } as BackupConfiguration;
}

function createService(db = createDb()) {
  drizzleState.db = db;
  return {
    db,
    service: new BackupConfigService({} as D1Database),
  };
}

describe("BackupConfigService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T03:04:05.000Z"));
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-1") });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(console.error).mockRestore();
    vi.useRealTimers();
  });

  it("lists and fetches configurations with camel and snake case row normalization", async () => {
    const { service } = createService(
      createDb({
        selectResults: [
          [row()],
          [
            row({
              restaurantId: undefined,
              restaurant_id: "restaurant-2",
              backupType: undefined,
              backup_type: "full",
              scheduleEnabled: undefined,
              schedule_enabled: 0,
              compressionEnabled: undefined,
              compression_enabled: 0,
              encryptionEnabled: undefined,
              encryption_enabled: 1,
              includeTables: undefined,
              include_tables: ["menu_items"],
              excludeTables: undefined,
              exclude_tables: [],
              notificationChannels: undefined,
              notification_channels: [],
            }),
          ],
          [],
        ],
      }),
    );

    await expect(service.getConfigurations("restaurant-1")).resolves.toEqual([
      expect.objectContaining({
        id: "config-1",
        restaurant_id: "restaurant-1",
        backup_type: "incremental",
        schedule_enabled: true,
        compression_enabled: true,
        encryption_enabled: false,
        include_tables: ["orders"],
        notification_channels: ["email"],
      }),
    ]);
    await expect(service.getConfigurationById("config-1")).resolves.toEqual(
      expect.objectContaining({
        restaurant_id: "restaurant-2",
        backup_type: "full",
        schedule_enabled: false,
        compression_enabled: false,
        encryption_enabled: true,
        include_tables: ["menu_items"],
      }),
    );
    await expect(service.getConfigurationById("missing")).resolves.toBeNull();
  });

  it("returns an existing default configuration or creates one when missing", async () => {
    const db = createDb({
      selectResults: [[row({ name: "Default Configuration" })], []],
    });
    const { service } = createService(db);

    await expect(
      service.getDefaultConfiguration("restaurant-1"),
    ).resolves.toMatchObject({
      id: "config-1",
      name: "Default Configuration",
      restaurant_id: "restaurant-1",
    });

    await expect(
      service.getDefaultConfiguration("restaurant-2"),
    ).resolves.toMatchObject({
      id: "uuid-1",
      restaurant_id: "restaurant-2",
      name: "Default Configuration",
      backup_type: "full",
      include_tables: [
        "orders",
        "order_items",
        "menu_items",
        "categories",
        "tables",
      ],
      compression_enabled: true,
      created_by: "system",
      created_at: "2026-06-07T03:04:05.000Z",
    });
    expect(db.inserted[0]).toMatchObject({
      id: "uuid-1",
      restaurantId: "restaurant-2",
      name: "Default Configuration",
      backupType: "full",
    });
  });

  it("creates, updates, and upserts configurations with database column names", async () => {
    const db = createDb({ selectResults: [[row()]] });
    const { service } = createService(db);

    await expect(service.createConfiguration(config())).resolves.toMatchObject({
      id: "config-1",
      restaurant_id: "restaurant-1",
    });
    expect(db.inserted[0]).toMatchObject({
      id: "config-1",
      restaurantId: "restaurant-1",
      backupType: "incremental",
      scheduleEnabled: true,
      retentionDays: 14,
      notificationChannels: ["email"],
    });

    await expect(
      service.updateConfiguration("config-1", {
        name: "Updated",
        retention_days: 45,
      }),
    ).resolves.toMatchObject({
      name: "Updated",
      retention_days: 45,
      updated_at: "2026-06-07T03:04:05.000Z",
    });
    expect(db.updated[0]).toMatchObject({
      name: "Updated",
      retentionDays: 45,
      updatedAt: expect.any(Date),
    });

    await expect(
      service.createOrUpdateConfiguration(
        {
          restaurant_id: "restaurant-3",
          name: "Created from input",
          compression_enabled: false,
        },
        "user-9",
      ),
    ).resolves.toMatchObject({
      id: "uuid-1",
      restaurant_id: "restaurant-3",
      name: "Created from input",
      backup_type: "full",
      compression_enabled: false,
      created_by: "user-9",
    });
    expect(db.inserted[1]).toMatchObject({
      id: "uuid-1",
      restaurantId: "restaurant-3",
      backupType: "full",
      compressionEnabled: false,
      maxParallelBackups: 1,
      notificationsEnabled: false,
    });
  });

  it("rejects missing and cross-restaurant updates through the wrapped save path", async () => {
    const { service } = createService(
      createDb({ selectResults: [[], [row({ restaurantId: "restaurant-1" })]] }),
    );

    await expect(
      service.updateConfiguration("missing", { name: "Updated" }),
    ).rejects.toThrow("Failed to update backup configuration");
    await expect(
      service.updateConfiguration("config-1", {
        restaurant_id: "restaurant-2",
      }),
    ).rejects.toThrow("Failed to update backup configuration");
  });

  it("deletes unused configurations and blocks configurations referenced by backups", async () => {
    const db = createDb({
      selectResults: [[{ total: 0 }], [{ total: 2 }]],
    });
    const { service } = createService(db);

    await expect(service.deleteConfiguration("config-1")).resolves
      .toBeUndefined();
    expect(db.deleted).toHaveLength(1);

    await expect(service.deleteConfiguration("config-2")).rejects.toThrow(
      "Failed to delete backup configuration",
    );
  });

  it("returns scheduled configurations only when enabled with cron expressions", async () => {
    const { service } = createService(
      createDb({
        selectResults: [
          [
            row({
              id: "scheduled-1",
              scheduleEnabled: true,
              scheduleCron: "0 2 * * *",
            }),
          ],
        ],
      }),
    );

    await expect(service.getScheduledConfigurations()).resolves.toMatchObject([
      {
        id: "scheduled-1",
        schedule_enabled: true,
        schedule_cron: "0 2 * * *",
      },
    ]);
  });

  it("validates configuration compatibility across storage, tables, schedules, and notifications", async () => {
    const { service } = createService();

    await expect(
      service.validateConfigurationCompatibility(
        config({ storage_provider: "external" }),
      ),
    ).rejects.toThrow("External storage provider is not currently supported");
    await expect(
      service.validateConfigurationCompatibility(
        config({
          include_tables: ["orders", "menus"],
          exclude_tables: ["menus"],
        }),
      ),
    ).rejects.toThrow("Tables cannot be both included and excluded: menus");
    await expect(
      service.validateConfigurationCompatibility(
        config({ schedule_enabled: true, schedule_cron: undefined }),
      ),
    ).rejects.toThrow("Schedule is enabled but no cron expression provided");
    await expect(
      service.validateConfigurationCompatibility(
        config({ notifications_enabled: true, notification_channels: [] }),
      ),
    ).rejects.toThrow(
      "Notifications are enabled but no notification channels specified",
    );
    await expect(
      service.validateConfigurationCompatibility(config()),
    ).resolves.toBeUndefined();
  });

  it("clones configurations for another restaurant with a new identity", async () => {
    const db = createDb({ selectResults: [[row({ name: "Source" })]] });
    const { service } = createService(db);

    await expect(
      service.cloneConfiguration("config-1", "restaurant-2", "user-2"),
    ).resolves.toMatchObject({
      id: "uuid-1",
      restaurant_id: "restaurant-2",
      name: "Source (Copy)",
      created_by: "user-2",
      created_at: "2026-06-07T03:04:05.000Z",
    });
    expect(db.inserted[0]).toMatchObject({
      id: "uuid-1",
      restaurantId: "restaurant-2",
      name: "Source (Copy)",
      createdBy: "user-2",
    });
  });

  it("wraps database failures with service-specific errors", async () => {
    const throwingDb = {
      select: vi.fn(() => {
        throw new Error("select down");
      }),
      insert: vi.fn(() => {
        throw new Error("insert down");
      }),
    };
    const { service } = createService(throwingDb as never);

    await expect(service.getConfigurations("restaurant-1")).rejects.toThrow(
      "Failed to fetch backup configurations",
    );
    await expect(service.getConfigurationById("config-1")).rejects.toThrow(
      "Failed to fetch backup configuration",
    );
    await expect(
      service.getDefaultConfiguration("restaurant-1"),
    ).rejects.toThrow("Failed to get default configuration");
    await expect(service.createConfiguration(config())).rejects.toThrow(
      "Failed to create backup configuration",
    );
    await expect(service.getScheduledConfigurations()).rejects.toThrow(
      "Failed to fetch scheduled configurations",
    );
    await expect(
      service.cloneConfiguration("missing", "restaurant-2", "user-2"),
    ).rejects.toThrow("Failed to clone backup configuration");
    await expect(
      service.createOrUpdateConfiguration({ name: "Bad" }, "user-1"),
    ).rejects.toThrow("Failed to save backup configuration");
  });
});
