import Papa from "papaparse";
import type { CategoryData } from "@/composables/useMenuManagement";

export interface MenuItemImportInput {
  name: string;
  categoryId: number;
  catalogType: "menu_item" | "product";
  price: number;
  description?: string;
  imageUrl?: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  tags?: string[];
  keywords?: string;
}

export interface MenuItemImportParseResult {
  items: MenuItemImportInput[];
  errors: string[];
}

const csvFields = [
  "name",
  "category",
  "price",
  "description",
  "imageUrl",
  "isFeatured",
  "isAvailable",
  "sortOrder",
  "catalogType",
  "tags",
  "keywords",
] as const;

type CsvField = (typeof csvFields)[number];
type CsvRow = Record<CsvField, string | undefined>;

export function buildMenuItemImportTemplate(
  categoryName = "主食",
  marketKeyword = "",
) {
  const keywords = ["蚵仔煎", "夜市", marketKeyword].filter(Boolean).join(" ");
  return [
    csvFields.join(","),
    [
      "蚵仔煎",
      categoryName,
      "7000",
      "招牌小吃",
      "",
      "true",
      "true",
      "1",
      "menu_item",
      "小吃;招牌",
      keywords,
    ].join(","),
    [
      "紅茶",
      categoryName,
      "2500",
      "古早味紅茶",
      "",
      "false",
      "true",
      "2",
      "menu_item",
      "飲料",
      "",
    ].join(","),
  ].join("\n");
}

export function parseMenuItemImport(
  text: string,
  categories: CategoryData[],
): MenuItemImportParseResult {
  if (!text.trim()) {
    return { items: [], errors: ["請貼上要匯入的商品資料。"] };
  }

  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });
  const errors = parsed.errors.map(
    (error) =>
      `第 ${
        error.row === undefined ? 1 : error.row + 2
      } 列：CSV 格式不正確 (${error.message})。`,
  );
  const items: MenuItemImportInput[] = [];

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const item = csvRowToMenuItem(row, categories);
    const rowErrors = validateMenuItemImportRow(item, row, categories, line);
    errors.push(...rowErrors);
    if (rowErrors.length === 0 && item) {
      items.push(item);
    }
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push("請貼上至少一筆商品資料。");
  }

  return {
    items: errors.length > 0 ? [] : items,
    errors,
  };
}

function csvRowToMenuItem(
  row: CsvRow,
  categories: CategoryData[],
): MenuItemImportInput | null {
  const categoryId = resolveCategoryId(row.category, categories);
  if (!categoryId) return null;

  const tags = parseTags(row.tags);
  const item: MenuItemImportInput = {
    name: normalizeCell(row.name) ?? "",
    categoryId,
    catalogType: parseCatalogType(row.catalogType) ?? "menu_item",
    price: parseOptionalInteger(row.price) ?? 0,
    isFeatured: parseBoolean(row.isFeatured, false),
    isAvailable: parseBoolean(row.isAvailable, true),
    sortOrder: parseOptionalInteger(row.sortOrder) ?? 0,
  };
  assignIfDefined(item, "description", normalizeCell(row.description));
  assignIfDefined(item, "imageUrl", normalizeCell(row.imageUrl));

  if (tags.length) {
    item.tags = tags;
  }

  item.keywords = (normalizeCell(row.keywords) ?? tags.join(" ")) || undefined;

  return item;
}

function assignIfDefined<T extends keyof MenuItemImportInput>(
  item: MenuItemImportInput,
  key: T,
  value: MenuItemImportInput[T] | undefined,
) {
  if (value !== undefined) {
    item[key] = value;
  }
}

function normalizeCell(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveCategoryId(
  value: string | undefined,
  categories: CategoryData[],
) {
  const normalized = normalizeCell(value);
  if (!normalized) return null;

  const numericId = Number(normalized);
  if (Number.isInteger(numericId)) {
    return categories.some((category) => category.id === numericId)
      ? numericId
      : null;
  }

  return (
    categories.find((category) => category.name === normalized)?.id ?? null
  );
}

function parseOptionalInteger(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (normalized === undefined) return undefined;
  return Number(normalized);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = normalizeCell(value);
  if (normalized === undefined) return fallback;
  return ["true", "1", "yes", "y", "是"].includes(normalized.toLowerCase());
}

function parseTags(value: string | undefined) {
  return (
    normalizeCell(value)
      ?.split(/[;,，、]/)
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

function validateMenuItemImportRow(
  item: MenuItemImportInput | null,
  row: CsvRow,
  categories: CategoryData[],
  line: number,
) {
  const errors: string[] = [];

  if (!item?.name) {
    errors.push(`第 ${line} 列：name 必填。`);
  }

  if (!resolveCategoryId(row.category, categories)) {
    errors.push(`第 ${line} 列：category 找不到對應分類。`);
  }

  if (!isOptionalIntegerInRange(parseOptionalInteger(row.price), 0)) {
    errors.push(`第 ${line} 列：price 必須是 0 以上整數分。`);
  }

  const imageUrl = normalizeCell(row.imageUrl);
  if (imageUrl && !isValidUrl(imageUrl)) {
    errors.push(`第 ${line} 列：imageUrl 必須是有效 URL。`);
  }

  if (!isOptionalIntegerInRange(parseOptionalInteger(row.sortOrder), 0)) {
    errors.push(`第 ${line} 列：sortOrder 必須是 0 以上整數。`);
  }

  if (normalizeCell(row.catalogType) && !parseCatalogType(row.catalogType)) {
    errors.push(`第 ${line} 列：catalogType 必須是 menu_item 或 product。`);
  }

  return errors;
}

function parseCatalogType(value: string | undefined) {
  const normalized = normalizeCell(value);
  if (normalized === "menu_item" || normalized === "product") {
    return normalized;
  }
  return undefined;
}

function isOptionalIntegerInRange(value: number | undefined, min: number) {
  if (value === undefined) return true;
  return Number.isInteger(value) && value >= min;
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
