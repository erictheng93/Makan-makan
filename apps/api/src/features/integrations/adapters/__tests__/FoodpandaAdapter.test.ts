import { describe, it, expect, beforeEach } from "vitest";
import { FoodpandaAdapter } from "../FoodpandaAdapter";
import type {
  PlatformCredentials,
  MenuSyncPayload,
} from "@makanmakan/shared-types";

describe("FoodpandaAdapter", () => {
  let adapter: FoodpandaAdapter;

  beforeEach(() => {
    adapter = new FoodpandaAdapter();
  });

  it("should have platform set to foodpanda", () => {
    expect(adapter.platform).toBe("foodpanda");
  });

  describe("stub methods — all throw 'not yet implemented'", () => {
    const expectedError = "Foodpanda integration not yet implemented";

    const dummyCreds: PlatformCredentials = {
      clientId: "test-client",
      clientSecret: "test-secret",
      storeId: "store-1",
    };

    const dummyMenuPayload: MenuSyncPayload = {
      restaurantId: "rest-001",
      categories: [
        {
          id: 1,
          name: "Main",
          items: [{ id: 10, name: "Roti Canai", price: 300, available: true }],
        },
      ],
    };

    it("verifyWebhook should throw not implemented", async () => {
      const request = new Request("https://example.com/webhook", {
        method: "POST",
        body: "{}",
      });

      await expect(
        adapter.verifyWebhook(request, "webhook-secret"),
      ).rejects.toThrow(expectedError);
    });

    it("refreshToken should throw not implemented", async () => {
      await expect(adapter.refreshToken(dummyCreds)).rejects.toThrow(
        expectedError,
      );
    });

    it("parseOrder should throw not implemented", async () => {
      await expect(
        adapter.parseOrder({ order_id: "fp-001", items: [] }),
      ).rejects.toThrow(expectedError);
    });

    it("acceptOrder should throw not implemented", async () => {
      await expect(
        adapter.acceptOrder("fp-order-001", dummyCreds),
      ).rejects.toThrow(expectedError);
    });

    it("denyOrder should throw not implemented", async () => {
      await expect(
        adapter.denyOrder("fp-order-001", "Out of stock", dummyCreds),
      ).rejects.toThrow(expectedError);
    });

    it("cancelOrder should throw not implemented", async () => {
      await expect(
        adapter.cancelOrder("fp-order-001", "Kitchen closed", dummyCreds),
      ).rejects.toThrow(expectedError);
    });

    it("syncMenu should throw not implemented", async () => {
      await expect(
        adapter.syncMenu(dummyMenuPayload, dummyCreds),
      ).rejects.toThrow(expectedError);
    });
  });

  describe("implements PlatformAdapter interface", () => {
    it("should have all required methods", () => {
      expect(typeof adapter.verifyWebhook).toBe("function");
      expect(typeof adapter.refreshToken).toBe("function");
      expect(typeof adapter.parseOrder).toBe("function");
      expect(typeof adapter.acceptOrder).toBe("function");
      expect(typeof adapter.denyOrder).toBe("function");
      expect(typeof adapter.cancelOrder).toBe("function");
      expect(typeof adapter.syncMenu).toBe("function");
    });
  });
});
