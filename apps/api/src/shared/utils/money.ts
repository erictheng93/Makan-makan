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
  return Math.abs(cents - Math.round(cents)) < 1e-9;
}

export function percentageFromBps(
  bps: number | null | undefined,
  fallback?: number | null | undefined,
): number | null {
  if (bps == null) return fallback ?? null;
  return bps / 100;
}
