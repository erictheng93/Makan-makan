import { describe, expect, it } from "vitest";
import { auditLogQuerySchema, managerActionSchema } from "./validation";

describe("manager validation schemas", () => {
  it("canonicalizes manager action resource IDs", () => {
    expect(
      managerActionSchema.parse({
        restaurantId: "restaurant-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: 123,
        payload: { isAvailable: false },
      }),
    ).toMatchObject({
      resourceId: "123",
      payload: { isAvailable: false },
    });

    expect(() =>
      managerActionSchema.parse({
        restaurantId: "restaurant-1",
        action: "delete_menu_item",
        resource: "menu_item",
        resourceId: 123,
      }),
    ).toThrow();
  });

  it("transforms audit log filters and defaults pagination", () => {
    expect(
      auditLogQuerySchema.parse({
        actorId: "7",
        onBehalfOfUserId: "8",
      }),
    ).toEqual({
      actorId: 7,
      onBehalfOfUserId: 8,
      limit: 50,
      offset: 0,
    });

    expect(() => auditLogQuerySchema.parse({ actorId: "abc" })).toThrow();
  });
});
