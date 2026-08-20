import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import { AuditLogService } from "./AuditLogService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createSelectQuery(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createService() {
  return new AuditLogService({ DB: { binding: "db" } } as unknown as Env);
}

describe("AuditLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes audit log rows and caps requested limits", async () => {
    const createdAt = new Date("2026-06-07T00:00:00.000Z");
    const query = createSelectQuery([
      {
        id: "101",
        userId: "user-7",
        onBehalfOfUserId: "user-8",
        restaurantId: "restaurant-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: "55",
        description: "Owner approved update",
        changes: { payload: { isAvailable: false } },
        success: 1,
        createdAt,
      },
      {
        id: 102,
        userId: null,
        onBehalfOfUserId: null,
        restaurantId: null,
        action: "sync",
        resource: "integration",
        resourceId: null,
        description: "No actor",
        changes: null,
        success: false,
        createdAt: 1710000000000,
      },
    ]);
    mocks.db.select.mockReturnValue(query);

    await expect(
      createService().list({
        action: "update_menu_availability",
        actorId: "user-7",
        limit: 250,
        offset: 10,
        onBehalfOfUserId: "user-8",
        resource: "menu_item",
        resourceId: "55",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual({
      count: 2,
      logs: [
        {
          id: 101,
          actorId: "user-7",
          userId: "user-7",
          onBehalfOfUserId: "user-8",
          delegatedUserId: "user-8",
          restaurantId: "restaurant-1",
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: "55",
          description: "Owner approved update",
          changes: { payload: { isAvailable: false } },
          success: true,
          createdAt: createdAt.getTime(),
        },
        {
          id: 102,
          actorId: null,
          userId: null,
          onBehalfOfUserId: null,
          delegatedUserId: null,
          restaurantId: null,
          action: "sync",
          resource: "integration",
          resourceId: null,
          description: "No actor",
          changes: null,
          success: false,
          createdAt: 1710000000000,
        },
      ],
    });

    expect(query.limit).toHaveBeenCalledWith(100);
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(query.where).toHaveBeenCalledWith(expect.anything());
  });

  it("lists without filters and maps unsupported timestamps to null", async () => {
    const query = createSelectQuery([
      {
        id: 1,
        userId: "user-1",
        onBehalfOfUserId: undefined,
        restaurantId: "restaurant-1",
        action: "created",
        resource: "table",
        resourceId: undefined,
        description: "Created table",
        changes: {},
        success: "1",
        createdAt: "2026-06-07",
      },
    ]);
    mocks.db.select.mockReturnValue(query);

    await expect(
      createService().list({ limit: 25, offset: 0 }),
    ).resolves.toEqual({
      count: 1,
      logs: [
        expect.objectContaining({
          createdAt: null,
          delegatedUserId: null,
          resourceId: null,
          success: true,
        }),
      ],
    });

    expect(query.where).toHaveBeenCalledWith(undefined);
    expect(query.limit).toHaveBeenCalledWith(25);
  });
});
