export interface LocalizedMenuName {
  name: string;
  nameEn?: string | null;
}

export interface SearchableMenuItem extends LocalizedMenuName {
  description?: string | null;
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

/**
 * Match a search query against BOTH names, never against the localised one.
 *
 * Filtering on `getLocalizedMenuName` looks right and is not: it narrows the
 * haystack to whichever name the current locale renders, so an English visitor
 * could no longer find 雞飯 by typing it, and a Chinese visitor could not find
 * an item by its English name. Deliberately locale-independent — what the
 * visitor can see is a rendering concern, what they can find is not.
 *
 * Four identical copies of this predicate lived in the two menu views; that is
 * how the regression reached all of them at once.
 */
export function menuItemMatchesQuery(
  item: SearchableMenuItem,
  query: string,
): boolean {
  const needle = query.toLowerCase().trim();
  if (!needle) return true;

  return (
    item.name.toLowerCase().includes(needle) ||
    !!item.nameEn?.toLowerCase().includes(needle) ||
    !!item.description?.toLowerCase().includes(needle)
  );
}
