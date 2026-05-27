export type CatalogResultType = "menu_item" | "product";

const PRODUCT_TAGS = new Set([
  "商品",
  "product",
  "goods",
  "retail",
  "物販",
  "零售",
]);

export function catalogResultTypeFromTags(
  tags: string[] | null | undefined,
): CatalogResultType {
  return (tags ?? []).some((tag) => PRODUCT_TAGS.has(tag.trim().toLowerCase()))
    ? "product"
    : "menu_item";
}
