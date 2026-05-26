function parseArrayish(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return parseArrayish(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }

  return trimmed
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeSearchTags(
  tags: unknown,
  keywords: unknown,
): string[] {
  return [...new Set([...parseArrayish(tags), ...parseArrayish(keywords)])];
}
