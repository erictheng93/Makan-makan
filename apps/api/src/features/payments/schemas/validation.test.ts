import { describe, expect, it } from "vitest";
import { paymentRequestSchema } from "./validation";

describe("payment validation schemas", () => {
  const orderId = "018f0000-0000-7000-8000-000000001001";

  it("accepts full payments with defaults", () => {
    expect(
      paymentRequestSchema.parse({
        orderId,
        amount: 25.5,
        method: "cash",
      }),
    ).toMatchObject({
      orderId,
      paymentMode: "full",
      amount: 25.5,
      method: "cash",
    });
  });

  it("requires an amount for full payment mode", () => {
    expect(() =>
      paymentRequestSchema.parse({
        orderId,
        method: "cash",
      }),
    ).toThrow(/amount is required/);
  });

  it("accepts bounded partial payment arrays", () => {
    expect(
      paymentRequestSchema.parse({
        orderId,
        paymentMode: "partial",
        payments: [
          { method: "cash", amount: 10 },
          { method: "card", amount: 15.5 },
        ],
      }),
    ).toMatchObject({
      paymentMode: "partial",
      payments: [
        { method: "cash", amount: 10 },
        { method: "card", amount: 15.5 },
      ],
    });

    expect(() =>
      paymentRequestSchema.parse({
        orderId,
        paymentMode: "partial",
      }),
    ).toThrow(/payments are required/);
  });

  it("rejects non-finite or negative money values", () => {
    expect(() =>
      paymentRequestSchema.parse({
        orderId,
        amount: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
    expect(() =>
      paymentRequestSchema.parse({
        orderId,
        amount: -1,
      }),
    ).toThrow();
  });
});
