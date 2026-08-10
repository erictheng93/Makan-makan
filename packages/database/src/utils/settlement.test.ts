import { describe, expect, it } from "vitest";
import { isRevenueRecognisedSettlement } from "./settlement";

describe("isRevenueRecognisedSettlement", () => {
  // The whole reason the column exists: "paid" alone cannot tell a diner's
  // own declaration apart from money the restaurant actually received.
  it("does not count a diner's own declaration as takings", () => {
    expect(
      isRevenueRecognisedSettlement({
        paymentStatus: "paid",
        settledBy: "self",
      }),
    ).toBe(false);
  });

  it("counts a restaurant or processor confirmation", () => {
    expect(
      isRevenueRecognisedSettlement({
        paymentStatus: "paid",
        settledBy: "staff",
      }),
    ).toBe(true);
    expect(
      isRevenueRecognisedSettlement({
        paymentStatus: "paid",
        settledBy: "provider",
      }),
    ).toBe(true);
  });

  it("counts nothing that is not paid", () => {
    expect(
      isRevenueRecognisedSettlement({
        paymentStatus: "pending",
        settledBy: "staff",
      }),
    ).toBe(false);
  });

  // Rows written before the column existed, and pending rows, carry no answer.
  it("treats a missing answer as not takings", () => {
    expect(
      isRevenueRecognisedSettlement({ paymentStatus: "paid", settledBy: null }),
    ).toBe(false);
    expect(isRevenueRecognisedSettlement({ paymentStatus: "paid" })).toBe(
      false,
    );
  });
});
