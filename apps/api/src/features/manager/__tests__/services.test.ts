import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Drizzle mocks ─────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  desc: vi.fn((col: any) => ({ type: "desc", col })),
}));

vi.mock("@makanmakan/database", () => ({
  auditLogs: {
    id: "id",
    userId: "user_id",
    onBehalfOfUserId: "on_behalf_of_user_id",
    restaurantId: "restaurant_id",
    action: "action",
    resource: "resource",
    resourceId: "resource_id",
    description: "description",
    changes: "changes",
    success: "success",
    createdAt: "created_at_ms",
  },
  menuItems: {
    id: "id",
    isAvailable: "is_available",
    updatedAt: "updated_at_ms",
  },
}));

import { ManagerActionsService } from "../services/ManagerActionsService";
import { AuditLogService } from "../services/AuditLogService";

const actor = {
  id: 42,
  username: "manager-42",
  role: 1,
} as never;

// The service chain is one of:
//   select().from().where().limit(1)                  (menu item lookup)
//   select().from().where().orderBy().limit().offset() (audit log list)
// A thenable proxy lets us handle both terminators without branching.
function chain(returnValue: unknown) {
  const promise = Promise.resolve(returnValue);
  const proxy: any = {
    from: vi.fn(() => proxy),
    where: vi.fn(() => proxy),
    orderBy: vi.fn(() => proxy),
    limit: vi.fn(() => proxy),
    offset: vi.fn(() => proxy),
    then: (onResolve: any, onReject: any) => promise.then(onResolve, onReject),
    catch: (onReject: any) => promise.catch(onReject),
    finally: (onFinally: any) => promise.finally(onFinally),
  };
  return proxy;
}

function insertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  };
}

function updateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ManagerActionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes an audit row with actor and onBehalfOfUserId on the happy path", async () => {
    // First select: menu item lookup returns one row.
    mockSelect.mockReturnValue(chain([{ isAvailable: true }]));
    mockUpdate.mockReturnValue(updateChain());
    mockInsert.mockReturnValue(insertChain([{ id: 7 }]));

    const service = new ManagerActionsService({ DB: {} } as never);
    const result = await service.execute(
      {
        restaurantId: "rest-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: "15",
        onBehalfOfUserId: 99,
        reason: "M1 gate",
      } as never,
      actor,
    );

    expect(result.auditLogId).toBe(7);
    expect(result.actorId).toBe(42);
    expect(result.onBehalfOfUserId).toBe(99);
    expect(result.executed).toBe(true);
    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledOnce(); // toggled menu availability
  });

  it("uses payload.isAvailable when provided", async () => {
    mockSelect.mockReturnValue(chain([{ isAvailable: true }]));
    const updateSpy = updateChain();
    mockUpdate.mockReturnValue(updateSpy);
    mockInsert.mockReturnValue(insertChain([{ id: 8 }]));

    const service = new ManagerActionsService({ DB: {} } as never);
    await service.execute(
      {
        restaurantId: "rest-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: "15",
        payload: { isAvailable: false },
      } as never,
      actor,
    );

    expect(updateSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ isAvailable: false }),
    );
  });

  it("rejects update_menu_availability against a non menu_item resource", async () => {
    const service = new ManagerActionsService({ DB: {} } as never);
    await expect(
      service.execute(
        {
          restaurantId: "rest-1",
          action: "update_menu_availability",
          resource: "order" as never,
          resourceId: "1",
        } as never,
        actor,
      ),
    ).rejects.toMatchObject({ code: "MANAGER_ACTION_INVALID" });
  });

  it("returns 404 when the targeted menu item does not exist", async () => {
    mockSelect.mockReturnValue(chain([])); // empty result

    const service = new ManagerActionsService({ DB: {} } as never);
    await expect(
      service.execute(
        {
          restaurantId: "rest-1",
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: "999",
        } as never,
        actor,
      ),
    ).rejects.toMatchObject({ code: "MENU_ITEM_NOT_FOUND" });
  });
});

describe("AuditLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rows aliased with both actor/user and onBehalfOf/delegated keys", async () => {
    mockSelect.mockReturnValue(
      chain([
        {
          id: 1,
          userId: 42,
          onBehalfOfUserId: 99,
          restaurantId: "rest-1",
          action: "update_menu_availability",
          resource: "menu_item",
          resourceId: "15",
          description: "M1 gate",
          changes: { metadata: { reason: "test" } },
          success: true,
          createdAt: new Date("2026-04-23T00:00:00Z"),
        },
      ]),
    );

    const service = new AuditLogService({ DB: {} } as never);
    const result = await service.list({
      resourceId: "15",
      limit: 50,
      offset: 0,
    } as never);

    expect(result.logs).toHaveLength(1);
    const entry = result.logs[0];
    expect(entry.actorId).toBe(42);
    expect(entry.userId).toBe(42);
    expect(entry.onBehalfOfUserId).toBe(99);
    expect(entry.delegatedUserId).toBe(99);
    expect(entry.createdAt).toBe(Date.parse("2026-04-23T00:00:00Z"));
  });

  it("caps limit at MAX_LIMIT=100", async () => {
    const innerChain = chain([]);
    mockSelect.mockReturnValue(innerChain);

    const service = new AuditLogService({ DB: {} } as never);
    await service.list({ limit: 999, offset: 0 } as never);

    expect(innerChain.limit).toHaveBeenCalledWith(100);
  });
});
