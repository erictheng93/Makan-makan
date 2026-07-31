export interface LocalizedMenuName {
  name: string;
  nameEn?: string | null;
}

/**
 * Product content currently has an English override only. Keep the fallback
 * here so every customer-facing surface applies the same rule:
 * English -> nameEn when present, otherwise the canonical name; all other
 * locales -> the canonical name.
 */
export function getLocalizedMenuName(
  item: LocalizedMenuName,
  locale: string,
): string {
  if (locale?.startsWith("en") && item.nameEn?.trim()) {
    return item.nameEn.trim();
  }
  return item.name;
}
