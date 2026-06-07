import { describe, expect, it } from "vitest";
import {
  NotificationType,
  QueueType,
  validateJoinQueue,
} from "./queue-validators";

describe("queue validators", () => {
  it("applies queue defaults for valid join requests", () => {
    expect(
      validateJoinQueue({
        restaurantId: 42,
        customerName: "  Alice  ",
        partySize: 3,
      }),
    ).toMatchObject({
      restaurantId: 42,
      customerName: "Alice",
      partySize: 3,
      queueType: QueueType.ONLINE,
      tablePreferences: [],
      notificationMethods: [NotificationType.SMS],
    });
  });

  it("rejects invalid party sizes and contact fields", () => {
    expect(() =>
      validateJoinQueue({
        restaurantId: 42,
        customerName: "Alice",
        partySize: 0,
      }),
    ).toThrow();
    expect(() =>
      validateJoinQueue({
        restaurantId: 42,
        customerName: "Alice",
        customerEmail: "not-email",
        partySize: 2,
      }),
    ).toThrow();
  });
});
