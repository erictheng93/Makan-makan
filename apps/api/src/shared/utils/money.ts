export function toCents(amount: number | null | undefined): number | null {
  if (amount == null) return null;
  if (!Number.isFinite(amount)) {
    throw new Error("Money amount must be finite");
  }
  return Math.round(amount * 100);
}

export function toRequiredCents(amount: number): number {
  const cents = toCents(amount);
  if (cents == null) {
    throw new Error("Money amount is required");
  }
  return cents;
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function isCentAlignedAmount(amount: number): boolean {
  if (!Number.isFinite(amount)) return false;
  const cents = amount * 100;
  const nearest = Math.round(cents);
  // The tolerance has to scale with magnitude. A fixed 1e-9 false-rejects
  // legitimate two-decimal amounts from 131072.14 (2^17) upward, because one
  // ulp of `cents` already exceeds 1e-9 there — ordinary TWD totals for
  // catering orders and market checkouts would 400 with no way around it.
  return (
    Math.abs(cents - nearest) <=
    Math.max(1e-9, Math.abs(cents) * Number.EPSILON * 4)
  );
}

export function percentageFromBps(
  bps: number | null | undefined,
  fallback?: number | null | undefined,
): number | null {
  if (bps == null) return fallback ?? null;
  return bps / 100;
}
