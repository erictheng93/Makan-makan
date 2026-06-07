import { describe, expect, it } from "vitest";
import {
  guestRealtimeTokenRequestSchema,
  webSocketTokenRequestSchema,
} from "./validation";

describe("realtime validation schemas", () => {
  it("accepts staff websocket token requests", () => {
    expect(
      webSocketTokenRequestSchema.parse({
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "session-1",
      }),
    ).toEqual({
      roomType: "kitchen",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      sessionId: "session-1",
    });
  });

  it("requires valid room details", () => {
    expect(() =>
      webSocketTokenRequestSchema.parse({
        roomType: "unknown",
        roomId: "",
        restaurantId: "restaurant-1",
      }),
    ).toThrow(/Invalid room type|Room ID is required/);
  });

  it("accepts guest token exchange only with an order id", () => {
    const guestToken = `gt_${"a".repeat(64)}`;
    expect(
      guestRealtimeTokenRequestSchema.parse({
        restaurantId: "restaurant-1",
        guestToken,
        orderId: 1001,
      }),
    ).toMatchObject({
      restaurantId: "restaurant-1",
      guestToken,
      orderId: "1001",
    });

    expect(() =>
      guestRealtimeTokenRequestSchema.parse({
        restaurantId: "restaurant-1",
        guestToken,
      }),
    ).toThrow(/Order ID is required/);
  });

  it("requires signed table QR details when no guest token is provided", () => {
    expect(
      guestRealtimeTokenRequestSchema.parse({
        restaurantId: "restaurant-1",
        tableId: 12,
        qrCode: "https://shop.example.test/qr/signed",
      }),
    ).toMatchObject({
      tableId: "12",
      qrCode: "https://shop.example.test/qr/signed",
    });

    expect(() =>
      guestRealtimeTokenRequestSchema.parse({
        restaurantId: "restaurant-1",
        tableId: 12,
      }),
    ).toThrow(/signed table QR details/);
  });
});
