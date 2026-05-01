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

export function amountFromCents(
  cents: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (cents == null) return fallback ?? null;
  return fromCents(cents);
}
