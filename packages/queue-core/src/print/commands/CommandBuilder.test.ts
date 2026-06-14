import { describe, expect, it } from "vitest";
import type { PrintContent } from "@makanmakan/shared-types";
import { CommandBuilder } from "./CommandBuilder";

const createPrintContent = (): PrintContent => ({
  header: {
    restaurantInfo: {
      name: "MakanMakan",
      address: "Taipei",
      phone: "02-1234-5678",
      taxNumber: "12345678",
    },
    transactionInfo: {
      orderId: "order-123",
      tableNumber: "A1",
      customerName: "Lin",
      cashier: "System",
      timestamp: new Date("2026-06-07T00:00:00.000Z"),
      receiptNumber: "TW1780790400000-FEDCBA98",
    },
  },
  items: [
    {
      name: "Beef Noodles",
      quantity: 2,
      unitPrice: 120,
      totalPrice: 240,
      modifiers: [{ name: "Extra spicy", price: 10 }],
    },
  ],
  summary: {
    subtotal: 250,
    tax: [{ name: "營業稅", rate: 0.05, amount: 12.5, taxableAmount: 250 }],
    total: 262.5,
    payment: [{ method: "信用卡", amount: 300, details: "**** 1234" }],
    change: 37.5,
  },
  footer: {
    thankYouMessage: "Thank you for your visit!",
    thankYouMessageLocal: "謝謝光臨！",
    qrCode: {
      data: "https://makanmakan.com/receipt/order-123",
      size: "medium",
      label: "數位收據",
    },
    legalNotice: "本收據為電子發票證明聯",
  },
});

describe("CommandBuilder.fromPrintContent", () => {
  it("builds detailed receipt commands from formatted print content", () => {
    const commands =
      CommandBuilder.fromPrintContent(createPrintContent()).buildESCPOS();

    expect(commands).toContain("Receipt No:");
    expect(commands).toContain("TW1780790400000-FEDCBA98");
    expect(commands).toContain("Table:");
    expect(commands).toContain("Beef Noodles x2");
    expect(commands).toContain("+ Extra spicy");
    expect(commands).toContain("TOTAL:");
    expect(commands).toContain("信用卡:");
    expect(commands).toContain("**** 1234");
    expect(commands).toContain("Change:");
    expect(commands).toContain("數位收據");
    expect(commands.endsWith("\x1DV\x00")).toBe(true);
  });
});
