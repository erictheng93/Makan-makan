type MessageTree = Record<string, unknown>;

function isMessageTree(value: unknown): value is MessageTree {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeLocaleMessages<T extends MessageTree>(
  fallback: T,
  locale: MessageTree,
): T {
  const result: MessageTree = { ...fallback };

  for (const [key, value] of Object.entries(locale)) {
    const fallbackValue = fallback[key];
    result[key] =
      isMessageTree(fallbackValue) && isMessageTree(value)
        ? mergeLocaleMessages(fallbackValue, value)
        : value;
  }

  return result as T;
}
