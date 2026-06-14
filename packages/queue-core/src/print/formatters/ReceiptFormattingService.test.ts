import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintRequest } from "@makanmakan/shared-types";
import { ReceiptFormattingService } from "./ReceiptFormattingService";

const createReceiptRequest = (): PrintRequest => ({
  country: "TW",
  type: "receipt",
  restaurantId: "restaurant-1",
  data: {
    order: {
      id: "order-123",
      tableNumber: "A1",
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
      items: [
        {
          name: "Beef Noodles",
          quantity: 2,
          price: 120,
          modifiers: [{ name: "Extra spicy", price: 10 }],
        },
      ],
      subtotal: 250,
      tax: 12.5,
      total: 262.5,
    },
    customer: {
      name: "Lin",
    },
    payment: {
      method: "credit_card",
      amount: 300,
      change: 37.5,
      cardLast4: "1234",
      transactionId: "txn-123",
    },
  },
});

describe("ReceiptFormattingService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("formats receipt content from PrintRequest data", async () => {
    const service = new ReceiptFormattingService();

    const receipt = await service.formatReceipt(createReceiptRequest());

    expect(receipt.header.transactionInfo.orderId).toBe("order-123");
    expect(receipt.header.transactionInfo.tableNumber).toBe("A1");
    expect(receipt.header.transactionInfo.customerName).toBe("Lin");
    expect(receipt.items).toEqual([
      expect.objectContaining({
        name: "Beef Noodles",
        quantity: 2,
        unitPrice: 120,
        totalPrice: 240,
        modifiers: [{ name: "Extra spicy", price: 10 }],
      }),
    ]);
    expect(receipt.summary).toEqual(
      expect.objectContaining({
        subtotal: 250,
        total: 262.5,
        change: 37.5,
      }),
    );
    expect(receipt.summary.payment).toEqual([
      expect.objectContaining({
        method: "信用卡",
        amount: 300,
        details: "**** 1234",
      }),
    ]);
  });

  it("generates Taiwan receipt numbers without Math.random", async () => {
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "fedcba98-7654-4000-8000-fedcba987654",
    );
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for receipt numbers");
    });
    const service = new ReceiptFormattingService();

    const receipt = await service.formatReceipt(createReceiptRequest());

    expect(receipt.header.transactionInfo.receiptNumber).toBe(
      "TW1780790400000-FEDCBA98",
    );
    expect(randomSpy).not.toHaveBeenCalled();
  });
});
