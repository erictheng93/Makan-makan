/**
 * Settlement trust levels for a split bill.
 *
 * `paymentStatus: "paid"` answers "is this share done", not "did the
 * restaurant receive money". Those are different questions and only the second
 * one belongs in revenue.
 */
export type SettledBy = "self" | "staff" | "provider";

/**
 * Whether a settled share may be counted as takings.
 *
 * A diner marking their own share settled is bookkeeping between friends — the
 * restaurant is not in that loop and cannot vouch for it. Only a confirmation
 * from the restaurant or a payment processor can.
 *
 * Reach for this instead of writing `payment_status = 'paid'` in a report:
 * that condition alone counts self-declarations as money.
 */
export function isRevenueRecognisedSettlement(bill: {
  paymentStatus: string;
  settledBy?: string | null;
}): boolean {
  return (
    bill.paymentStatus === "paid" &&
    (bill.settledBy === "staff" || bill.settledBy === "provider")
  );
}
