import { describe, expect, it } from "vitest";
import {
  formatOwnerOrderTime,
  getOwnerOrderTableLabel,
  toOwnerRealtimeOrder,
} from "./ownerRealtimeOrders";

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${params.count}` : key;

describe("owner realtime order helpers", () => {
  it("uses the customer-facing table number instead of the internal table id", () => {
    expect(
      getOwnerOrderTableLabel({
        tableId: 2,
        // getOwnerOrderTableLabel only reads `table.number`; its parameter type
        // deliberately does not carry the internal `table.id`.
        table: { number: "A1" },
        orderNumber: "ORDER-001",
      }),
    ).toBe("A1");
  });

  it("falls back to legacy tableNumber before order number", () => {
    expect(
      getOwnerOrderTableLabel({
        tableId: 2,
        tableNumber: "B7",
        orderNumber: "ORDER-001",
      }),
    ).toBe("B7");
  });

  it("formats old orders in hours or days, not unbounded minutes", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");

    expect(formatOwnerOrderTime("2026-08-07T09:30:00.000Z", t, now)).toBe(
      "datetime.hoursAgo:2",
    );
    expect(formatOwnerOrderTime("2026-08-05T00:30:00.000Z", t, now)).toBe(
      "datetime.daysAgo:2",
    );
  });

  it("maps active order payloads for the owner overview panel", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");

    expect(
      toOwnerRealtimeOrder(
        {
          id: 101,
          orderNumber: "ORDER-101",
          status: "pending",
          tableId: 2,
          table: { id: 2, number: "A1" },
          createdAt: Date.parse("2026-08-07T11:55:00.000Z"),
          items: [{ id: 1 }, { id: 2 }],
        },
        t,
        now,
      ),
    ).toEqual({
      id: 101,
      tableNumber: "A1",
      items: 2,
      status: "pending",
      time: "datetime.minutesAgo:5",
    });
  });
});
