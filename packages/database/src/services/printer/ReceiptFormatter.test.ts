import { describe, expect, it, vi } from "vitest";
import { TaiwanReceiptFormatter } from "./ReceiptFormatter";
import type {
  PrintRequest,
  ReceiptTemplate,
  RegionConfig,
} from "@makanmakan/shared-types";

describe("TaiwanReceiptFormatter", () => {
  it("generates receipt numbers without Math.random", () => {
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "fedcba98-7654-4000-8000-fedcba987654",
    );
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for receipt numbers");
    });

    const formatter = new TaiwanReceiptFormatter(
      {
        country: "TW",
        currency: "TWD",
        locale: "zh-TW",
        timezone: "Asia/Taipei",
      } as RegionConfig,
      {} as ReceiptTemplate,
    );

    const receipt = formatter.formatReceipt({
      country: "TW",
      type: "receipt",
      restaurantId: "restaurant-1",
      data: {
        order: {
          id: "order-123",
          tableNumber: "A1",
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          items: [],
          subtotal: 100,
          total: 105,
        },
      },
    } as PrintRequest);

    expect(receipt.header.transactionInfo.receiptNumber).toBe(
      "TW1780790400000-FEDCBA98",
    );
    expect(randomSpy).not.toHaveBeenCalled();
  });
});
