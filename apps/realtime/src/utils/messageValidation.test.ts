import { describe, expect, it } from "vitest";
import {
  parseJsonMessage,
  validateAdvancedClientMessage,
  validateBasicClientMessage,
} from "./messageValidation";

describe("basic realtime client message validation", () => {
  it("accepts existing ping and subscription message shapes", () => {
    expect(
      validateBasicClientMessage({ type: "ping", timestamp: Date.now() })
        .success,
    ).toBe(true);

    expect(
      validateBasicClientMessage({
        type: "subscribe",
        channel: "orders",
        data: { eventTypes: ["new_order"] },
        timestamp: Date.now(),
      }).success,
    ).toBe(true);
  });

  it("rejects malformed basic messages before dispatch", () => {
    const result = validateBasicClientMessage({
      type: "ping",
      timestamp: "now",
    });

    expect(result.success).toBe(false);
  });

  it("parses string and ArrayBuffer websocket frames", () => {
    expect(parseJsonMessage('{"type":"ping"}')).toEqual({ type: "ping" });

    const encoded = new TextEncoder().encode('{"type":"unsubscribe"}').buffer;
    expect(parseJsonMessage(encoded)).toEqual({ type: "unsubscribe" });
  });
});

describe("advanced realtime client message validation", () => {
  it("accepts valid group order cart messages", () => {
    const result = validateAdvancedClientMessage({
      type: "add_cart_item",
      data: {
        groupOrderId: "group-1",
        memberId: "member-1",
        menuItemId: 10,
        menuItemName: "Nasi Lemak",
        quantity: 2,
        unitPrice: 120,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid group order payloads", () => {
    const result = validateAdvancedClientMessage({
      type: "add_cart_item",
      data: {
        groupOrderId: "group-1",
        memberId: "member-1",
        menuItemId: 10,
        menuItemName: "Nasi Lemak",
        quantity: 0,
        unitPrice: 120,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown advanced message types", () => {
    const result = validateAdvancedClientMessage({
      type: "DROP_TABLES",
      data: {},
    });

    expect(result.success).toBe(false);
  });
});
