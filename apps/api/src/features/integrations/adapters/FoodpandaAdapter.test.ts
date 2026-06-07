import { describe, expect, it } from "vitest";
import { FoodpandaAdapter } from "./FoodpandaAdapter";

describe("FoodpandaAdapter", () => {
  it("identifies the platform", () => {
    expect(new FoodpandaAdapter().platform).toBe("foodpanda");
  });

  it("fails every integration operation with the not-implemented contract", async () => {
    const adapter = new FoodpandaAdapter();
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "{}",
    });
    const credentials = { accessToken: "token" };
    const error = "Foodpanda integration not yet implemented";

    await expect(adapter.verifyWebhook(request, "secret")).rejects.toThrow(
      error,
    );
    await expect(adapter.refreshToken(credentials)).rejects.toThrow(error);
    await expect(adapter.parseOrder({ id: "order-1" })).rejects.toThrow(error);
    await expect(adapter.acceptOrder("order-1", credentials)).rejects.toThrow(
      error,
    );
    await expect(
      adapter.denyOrder("order-1", "out of stock", credentials),
    ).rejects.toThrow(error);
    await expect(
      adapter.cancelOrder("order-1", "closed", credentials),
    ).rejects.toThrow(error);
    await expect(
      adapter.syncMenu({ menus: [] } as never, credentials),
    ).rejects.toThrow(error);
  });
});
