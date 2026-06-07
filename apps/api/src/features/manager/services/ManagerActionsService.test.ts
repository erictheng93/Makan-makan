import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";
import type { Env } from "../../../types/env";
import { ManagerActionsService } from "./ManagerActionsService";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createQuery(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    returning: vi.fn(() => builder),
    set: vi.fn(() => builder),
    values: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (
      resolve: (value: unknown[]) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResult(result: unknown[]) {
  mocks.db.select.mockReturnValue(createQuery(result));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  mocks.db.update.mockImplementation(() => {
    const query = createQuery([]);
    query.set.mockImplementation((payload: unknown) => {
      updated.push(payload);
      return query;
    });
    return query;
  });

  mocks.db.insert.mockImplementation(() => {
    const query = createQuery([{ id: 777 }]);
    query.values.mockImplementation((payload: unknown) => {
      inserted.push(payload);
      return query;
    });
    query.returning.mockReturnValue(query);
    return query;
  });

  return { inserted, updated };
}

function createService() {
  return new ManagerActionsService({
    DB: { binding: "db" },
  } as unknown as Env);
}

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1",
    ...overrides,
  };
}

describe("ManagerActionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
  });

  it("updates menu availability and writes a delegated audit log", async () => {
    mockSelectResult([{ isAvailable: true }]);
    const mutations = mockMutations();

    await expect(
      createService().execute(
        {
          action: "update_menu_availability",
          onBehalfOfUserId: 8,
          payload: { isAvailable: false },
          reason: "Temporarily sold out",
          resource: "menu_item",
          resourceId: "55",
          restaurantId: "restaurant-1",
        },
        actor(),
      ),
    ).resolves.toEqual({
      auditLogId: 777,
      actorId: 7,
      onBehalfOfUserId: 8,
      action: "update_menu_availability",
      resource: "menu_item",
      resourceId: "55",
      executed: true,
    });

    expect(mutations.updated).toEqual([
      {
        isAvailable: false,
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ]);
    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        userId: 7,
        onBehalfOfUserId: 8,
        restaurantId: "restaurant-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: "55",
        description: "Temporarily sold out",
        success: true,
        changes: {
          metadata: {
            onBehalfOfUserId: 8,
            payload: { isAvailable: false },
            reason: "Temporarily sold out",
          },
        },
      }),
    ]);
  });

  it("toggles menu availability and falls back to generated descriptions", async () => {
    mockSelectResult([{ isAvailable: false }]);
    const mutations = mockMutations();

    await expect(
      createService().execute(
        {
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: 55,
          restaurantId: "restaurant-1",
        },
        actor(),
      ),
    ).resolves.toMatchObject({
      auditLogId: 777,
      executed: true,
      resourceId: 55,
    });

    expect(mutations.updated[0]).toMatchObject({ isAvailable: true });
    expect(mutations.inserted[0]).toMatchObject({
      description: "update_menu_availability on menu_item#55",
      onBehalfOfUserId: null,
    });
  });

  it("rejects invalid resources, invalid IDs, and missing menu items", async () => {
    mockMutations();

    await expect(
      createService().execute(
        {
          action: "update_menu_availability",
          resource: "restaurant",
          resourceId: "55",
          restaurantId: "restaurant-1",
        },
        actor(),
      ),
    ).rejects.toMatchObject({
      code: "MANAGER_ACTION_INVALID",
      status: 400,
    });

    await expect(
      createService().execute(
        {
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: "abc",
          restaurantId: "restaurant-1",
        },
        actor(),
      ),
    ).rejects.toMatchObject({
      code: "MANAGER_ACTION_INVALID",
      status: 400,
    });

    mockSelectResult([]);
    await expect(
      createService().execute(
        {
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: "55",
          restaurantId: "restaurant-1",
        },
        actor(),
      ),
    ).rejects.toMatchObject({
      code: "MENU_ITEM_NOT_FOUND",
      status: 404,
    });
  });
});
