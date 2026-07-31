export interface LocalizedMenuName {
  name: string;
  nameEn?: string | null;
}

export interface SearchableMenuItem extends LocalizedMenuName {
  description?: string | null;
}

/**
 * Product content has exactly two names — the canonical one (Chinese) and an
 * English override — so three audiences, not two:
 *
 * - Chinese locales read the canonical name.
 * - English locales read nameEn, falling back to the canonical name.
 * - Everyone else (ms-MY, id-ID, vi-VN) gets BOTH, English first. Those
 *   languages are written in the Latin alphabet, so nameEn is the half they
 *   can read; the Chinese half stays because it is what they can point at to
 *   order, and because dropping it would claim an accuracy the data does not
 *   have — nameEn is an English name, not a Malay or Vietnamese one.
 *
 * The bilingual form is longer than either half, so any surface rendering this
 * must allow two lines rather than truncate to one.
 */
export function getLocalizedMenuName(
  item: LocalizedMenuName,
  locale: string,
): string {
  const english = item.nameEn?.trim();
  // An absent locale means "we do not know who is reading" — answer with the
  // canonical name rather than guessing the widest form.
  if (!english || !locale || locale.startsWith("zh")) {
    return item.name;
  }
  if (locale?.startsWith("en")) {
    return english;
  }
  // Full-width parentheses: what they enclose is Chinese, and ASCII ones sit
  // badly against CJK glyphs.
  return `${english}（${item.name}）`;
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
