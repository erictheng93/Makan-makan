export function prefixedUuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function businessNumber(prefix: string, now = Date.now()): string {
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}${now}-${suffix}`;
}
