import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    run: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

import { BackupValidationService } from "./BackupValidationService";

const restaurantId = "019469a0-0001-7000-8000-000000000001";
const backupId = "019469a0-0002-7000-8000-000000000002";
const configurationId = "019469a0-0003-7000-8000-000000000003";

function createService() {
  return new BackupValidationService({} as D1Database);
}

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
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

function createContext(user: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => {
      if (key === "user") return user;
      return undefined;
    }),
  } as any;
}

function validCreateRequest(overrides: Record<string, unknown> = {}) {
  return {
    restaurant_id: restaurantId,
    name: "Daily backup",
    description: "Nightly full backup",
    backup_type: "full",
    configuration_id: configurationId,
    ...overrides,
  } as any;
}

function validRestoreRequest(overrides: Record<string, unknown> = {}) {
  return {
    restaurant_id: restaurantId,
    backup_id: backupId,
    restore_type: "full",
    safety_confirmation: {
      confirmation_phrase: "I understand the risks",
      backup_integrity_verified: true,
      data_loss_risk_acknowledged: true,
    },
    ...overrides,
  } as any;
}

function validConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    restaurant_id: restaurantId,
    name: "Default backup",
    description: "Daily restaurant backup",
    backup_type: "incremental",
    retention_days: 30,
    max_parallel_backups: 2,
    schedule_enabled: true,
    schedule_cron: "*/15 0-23 1,15 * 0-7",
    notification_channels: ["email", "slack"],
    ...overrides,
  } as any;
}

describe("BackupValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.select.mockReset();
    mocks.db.run.mockReset();
  });

  it("accepts valid create, restore, and configuration requests", async () => {
    const service = createService();

    await expect(
      service.validateCreateBackupRequest(validCreateRequest()),
    ).resolves.toBeUndefined();
    await expect(
      service.validateRestoreRequest(validRestoreRequest()),
    ).resolves.toBeUndefined();
    await expect(
      service.validateConfigurationRequest(validConfiguration()),
    ).resolves.toBeUndefined();
  });

  it("validates create backup request fields", async () => {
    const service = createService();

    await expect(
      service.validateCreateBackupRequest(validCreateRequest({ restaurant_id: "bad" })),
    ).rejects.toThrow("Valid restaurant ID is required");
    await expect(
      service.validateCreateBackupRequest(validCreateRequest({ name: "   " })),
    ).rejects.toThrow("Backup name is required");
    await expect(
      service.validateCreateBackupRequest(validCreateRequest({ name: "a".repeat(101) })),
    ).rejects.toThrow("Backup name must be 100 characters or less");
    await expect(
      service.validateCreateBackupRequest(
        validCreateRequest({ description: "a".repeat(501) }),
      ),
    ).rejects.toThrow("Backup description must be 500 characters or less");
    await expect(
      service.validateCreateBackupRequest(validCreateRequest({ backup_type: "snapshot" })),
    ).rejects.toThrow("Invalid backup type");
    await expect(
      service.validateCreateBackupRequest(
        validCreateRequest({ configuration_id: "not-a-uuid" }),
      ),
    ).rejects.toThrow("Invalid configuration ID");
  });

  it("validates restore safety and selective target requirements", async () => {
    const service = createService();

    await expect(
      service.validateRestoreRequest(validRestoreRequest({ backup_id: "bad" })),
    ).rejects.toThrow("Valid backup ID is required");
    await expect(
      service.validateRestoreRequest(validRestoreRequest({ restore_type: "partial" })),
    ).rejects.toThrow("Invalid restore type");
    await expect(
      service.validateRestoreRequest(validRestoreRequest({ safety_confirmation: undefined })),
    ).rejects.toThrow("Safety confirmation is required");
    await expect(
      service.validateRestoreRequest(
        validRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: "wrong",
            backup_integrity_verified: true,
            data_loss_risk_acknowledged: true,
          },
        }),
      ),
    ).rejects.toThrow("Safety confirmation phrase is incorrect");
    await expect(
      service.validateRestoreRequest(
        validRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: "I understand the risks",
            backup_integrity_verified: false,
            data_loss_risk_acknowledged: true,
          },
        }),
      ),
    ).rejects.toThrow("Backup integrity must be verified before restore");
    await expect(
      service.validateRestoreRequest(
        validRestoreRequest({
          safety_confirmation: {
            confirmation_phrase: "I understand the risks",
            backup_integrity_verified: true,
            data_loss_risk_acknowledged: false,
          },
        }),
      ),
    ).rejects.toThrow("Data loss risk must be acknowledged before restore");
    await expect(
      service.validateRestoreRequest(
        validRestoreRequest({ restore_type: "selective", target_tables: [] }),
      ),
    ).rejects.toThrow("Target tables must be specified for selective restore");
  });

  it("validates configuration fields and notification channels", async () => {
    const service = createService();

    await expect(
      service.validateConfigurationRequest(validConfiguration({ restaurant_id: "bad" })),
    ).rejects.toThrow("Valid restaurant ID is required");
    await expect(
      service.validateConfigurationRequest(validConfiguration({ name: "" })),
    ).rejects.toThrow("Configuration name is required");
    await expect(
      service.validateConfigurationRequest(validConfiguration({ name: "a".repeat(101) })),
    ).rejects.toThrow("Configuration name must be 100 characters or less");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ description: "a".repeat(501) }),
      ),
    ).rejects.toThrow("Configuration description must be 500 characters or less");
    await expect(
      service.validateConfigurationRequest(validConfiguration({ backup_type: "archive" })),
    ).rejects.toThrow("Invalid backup type");
    await expect(
      service.validateConfigurationRequest(validConfiguration({ retention_days: 0 })),
    ).rejects.toThrow("Retention days must be between 1 and 365");
    await expect(
      service.validateConfigurationRequest(validConfiguration({ max_parallel_backups: 11 })),
    ).rejects.toThrow("Max parallel backups must be between 1 and 10");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ notification_channels: ["email", "pagerduty"] }),
      ),
    ).rejects.toThrow("Invalid notification channels: pagerduty");
  });

  it("validates cron expression structure and field ranges", async () => {
    const service = createService();

    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "* * * *" }),
      ),
    ).rejects.toThrow("Cron expression must have exactly 5 parts");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "60 * * * *" }),
      ),
    ).rejects.toThrow("Invalid minute in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "* 24 * * *" }),
      ),
    ).rejects.toThrow("Invalid hour in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "* * 0 * *" }),
      ),
    ).rejects.toThrow("Invalid day in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "* * * 13 *" }),
      ),
    ).rejects.toThrow("Invalid month in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "* * * * 8" }),
      ),
    ).rejects.toThrow("Invalid day of week in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "*/0 * * * *" }),
      ),
    ).rejects.toThrow("Invalid minute in cron expression");
    await expect(
      service.validateConfigurationRequest(
        validConfiguration({ schedule_cron: "5-1 * * * *" }),
      ),
    ).rejects.toThrow("Invalid minute in cron expression");
  });

  describe("verifyRestaurantAccess", () => {
    // Regression guard for the original bug: verifyRestaurantAccess used to
    // run `SELECT ... FROM restaurant_users`, a table that does not exist
    // in the Drizzle schema (packages/database/src/schema/) or in
    // production D1. Every db.run/db.select call in this describe block is
    // wired to reject exactly the way a real D1 query against a missing
    // table does, so if the implementation ever regresses to querying
    // `restaurant_users` (or any other table) for this check, the
    // corresponding assertion below fails loudly instead of the mock
    // silently "authorizing" the call.
    beforeEach(() => {
      const missingTableError = new Error(
        "D1_ERROR: no such table: restaurant_users",
      );
      mocks.db.run.mockRejectedValue(missingTableError);
      mocks.db.select.mockImplementation(() => {
        throw missingTableError;
      });
    });

    it("allows admins (role 0) regardless of restaurant match", async () => {
      const service = createService();

      await expect(
        service.verifyRestaurantAccess(
          createContext({ id: 1, role: 0 }),
          restaurantId,
        ),
      ).resolves.toBeUndefined();
      expect(mocks.db.run).not.toHaveBeenCalled();
      expect(mocks.db.select).not.toHaveBeenCalled();
    });

    it("allows a restaurant owner (role 1) of the same restaurant", async () => {
      const service = createService();

      await expect(
        service.verifyRestaurantAccess(
          createContext({ id: 2, role: 1, restaurantId }),
          restaurantId,
        ),
      ).resolves.toBeUndefined();
      expect(mocks.db.run).not.toHaveBeenCalled();
      expect(mocks.db.select).not.toHaveBeenCalled();
    });

    it("denies a restaurant owner (role 1) of a DIFFERENT restaurant with a 403 ApiError", async () => {
      const service = createService();
      const otherRestaurantId = "019469a0-0004-7000-8000-000000000004";

      await expect(
        service.verifyRestaurantAccess(
          createContext({ id: 3, role: 1, restaurantId: otherRestaurantId }),
          restaurantId,
        ),
      ).rejects.toMatchObject({
        name: "ApiError",
        code: "FORBIDDEN",
        status: 403,
        message: expect.stringContaining("Access denied"),
      });
      expect(mocks.db.run).not.toHaveBeenCalled();
    });

    it("denies an owner with no restaurantId on their session", async () => {
      const service = createService();

      await expect(
        service.verifyRestaurantAccess(
          createContext({ id: 4, role: 1 }),
          restaurantId,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    });

    it("denies non-owner staff roles even for their own restaurant (least-privilege role gate)", async () => {
      const service = createService();

      for (const role of [2, 3, 4, 5]) {
        await expect(
          service.verifyRestaurantAccess(
            createContext({ id: `staff-${role}`, role, restaurantId }),
            restaurantId,
          ),
        ).rejects.toMatchObject({
          name: "ApiError",
          code: "BACKUP_ROLE_FORBIDDEN",
          status: 403,
        });
      }
      expect(mocks.db.run).not.toHaveBeenCalled();
    });
  });

  it("checks backup concurrency and recent attempt limits", async () => {
    const service = createService();

    mockSelectResults([[{ total: 2 }], [{ total: 9 }]]);
    await expect(service.checkBackupLimits(restaurantId)).resolves.toBeUndefined();

    mockSelectResults([[{ total: 3 }]]);
    await expect(service.checkBackupLimits(restaurantId)).rejects.toThrow(
      "Maximum number of concurrent backups reached",
    );

    mockSelectResults([[{ total: 0 }], [{ total: 10 }]]);
    await expect(service.checkBackupLimits(restaurantId)).rejects.toThrow(
      "Too many backup attempts in the last hour",
    );
  });

  it("validates table names and storage quota", async () => {
    const service = createService();

    await expect(
      service.validateTableNames(["orders", "menus", "audit_logs"]),
    ).resolves.toBeUndefined();
    await expect(
      service.validateTableNames(["orders", "credit_cards", "secrets"]),
    ).rejects.toThrow("Invalid table names: credit_cards, secrets");

    mockSelectResults([[{ totalSize: 9 * 1024 * 1024 * 1024 }]]);
    await expect(service.checkStorageQuota(restaurantId)).resolves.toBeUndefined();

    mockSelectResults([[{ totalSize: 10 * 1024 * 1024 * 1024 }]]);
    await expect(service.checkStorageQuota(restaurantId)).rejects.toThrow(
      "Storage quota exceeded",
    );

    mockSelectResults([[]]);
    await expect(service.checkStorageQuota(restaurantId)).resolves.toBeUndefined();
  });

  it("accepts project UUID v7 identifiers and rejects malformed values", () => {
    const service = createService();

    expect(service.isValidUUID(restaurantId)).toBe(true);
    expect(service.isValidUUID("019469a0-0001-9000-8000-000000000001")).toBe(
      false,
    );
    expect(service.isValidUUID("not-a-uuid")).toBe(false);
  });
});
