const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE36_REJECTION_LIMIT =
  Math.floor(256 / BASE36_ALPHABET.length) * BASE36_ALPHABET.length;

export function randomBase36(length: number): string {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("length must be a non-negative integer");
  }

  let result = "";
  while (result.length < length) {
    const remaining = length - result.length;
    const bytes = new Uint8Array(Math.max(remaining, 16));
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= BASE36_REJECTION_LIMIT) continue;
      result += BASE36_ALPHABET[byte % BASE36_ALPHABET.length];
      if (result.length === length) break;
    }
  }

  return result;
}

export function randomBase36Upper(length: number): string {
  return randomBase36(length).toUpperCase();
}

export function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBase36(12)}`;
}

export function generateLicenseKey(
  tier: "standard" | "professional" | "enterprise",
): string {
  const tierCode =
    tier === "standard" ? "STD" : tier === "professional" ? "PRO" : "ENT";
  return `MKM-${tierCode}-${randomBase36Upper(8)}-${randomBase36Upper(8)}`;
}
