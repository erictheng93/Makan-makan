import { v7 as uuidv7 } from "uuid";

export function prefixedUuid(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}

export function businessNumber(prefix: string, now = Date.now()): string {
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}${now}-${suffix}`;
}
