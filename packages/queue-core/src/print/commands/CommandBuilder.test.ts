import { describe, expect, it } from "vitest";
import type { PrintContent } from "@makanmasak/shared-types";
import { CommandBuilder } from "./CommandBuilder";

const createPrintContent = (): PrintContent => ({
  header: {
    restaurantInfo: {
      name: "MakanMasak",
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
      data: "https://makanmasak.com/receipt/order-123",
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

  // KDS 螢幕看得到外送地址，紙本出單票上沒有 —— 而拿著紙出門的正是送餐的人
  // （#295）。
  it("prints the delivery address and phone on its own lines", () => {
    const content = createPrintContent();
    content.header.transactionInfo.deliveryAddress =
      "台中市西屯區台灣大道三段99號12樓之3";
    content.header.transactionInfo.deliveryPhone = "0912345678";

    const commands = CommandBuilder.fromPrintContent(content).buildESCPOS();

    // 地址獨佔一行，標籤不會黏在門牌前面。
    expect(commands).toContain(
      "Delivery:\n台中市西屯區台灣大道三段99號12樓之3\n",
    );
    expect(commands).toContain("Delivery Tel:");
    expect(commands).toContain("0912345678");
  });

  it("omits the delivery lines for a non-delivery order", () => {
    const commands =
      CommandBuilder.fromPrintContent(createPrintContent()).buildESCPOS();

    expect(commands).not.toContain("Delivery:");
    expect(commands).not.toContain("Delivery Tel:");
  });
});
