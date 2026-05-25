export function normalizeE164Phone(value: string): string {
  const compact = value.trim().replace(/[\s\-().]/g, "");
  const digits = compact.startsWith("+")
    ? compact.slice(1).replace(/\D/g, "")
    : compact.replace(/\D/g, "");

  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("8860")) return `+886${digits.slice(4)}`;
  if (digits.startsWith("886")) return `+${digits}`;
  if (digits.startsWith("09")) return `+886${digits.slice(1)}`;
  if (compact.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}
