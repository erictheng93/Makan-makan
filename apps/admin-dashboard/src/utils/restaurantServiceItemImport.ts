import Papa from "papaparse";
import type { RestaurantServiceType } from "@makanmasak/shared-types";
import type { ServiceItemFormInput } from "@/services/restaurantServiceItemsService";

export interface RestaurantServiceItemImportParseResult {
  items: ServiceItemFormInput[];
  errors: string[];
}

const serviceTypes: RestaurantServiceType[] = [
  "general",
  "booking",
  "pickup",
  "delivery",
  "consultation",
  "rental",
  "activity",
];

const csvFields = [
  "name",
  "serviceType",
  "description",
  "priceCents",
  "priceLabel",
  "durationMinutes",
  "requiresBooking",
  "bookingUrl",
  "tags",
  "sortOrder",
  "isActive",
  "isPublic",
] as const;

type CsvField = (typeof csvFields)[number];
type CsvRow = Record<CsvField, string | undefined>;

export function buildRestaurantServiceItemImportTemplate() {
  return [
    csvFields.join(","),
    [
      "代客切水果",
      "general",
      "現場代切並分裝",
      "5000",
      "",
      "15",
      "false",
      "",
      "水果;分裝",
      "1",
      "true",
      "true",
    ].join(","),
    [
      "預約外送",
      "delivery",
      "",
      "",
      "依距離報價",
      "45",
      "true",
      "https://example.com/book",
      "外送",
      "2",
      "true",
      "true",
    ].join(","),
  ].join("\n");
}

export function parseRestaurantServiceItemImport(
  text: string,
): RestaurantServiceItemImportParseResult {
  if (!text.trim()) {
    return { items: [], errors: ["請貼上要匯入的服務資料。"] };
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
  const items: ServiceItemFormInput[] = [];

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const item = csvRowToServiceItem(row);
    const rowErrors = validateServiceItemImportRow(item, row, line);
    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      items.push(item);
    }
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push("請貼上至少一筆服務資料。");
  }

  return {
    items: errors.length > 0 ? [] : items,
    errors,
  };
}

function csvRowToServiceItem(row: CsvRow): ServiceItemFormInput {
  const tags = parseTags(row.tags);
  const item: ServiceItemFormInput = {
    name: normalizeCell(row.name) ?? "",
    serviceType: parseServiceType(row.serviceType),
    requiresBooking: parseBoolean(row.requiresBooking, false),
    sortOrder: parseOptionalInteger(row.sortOrder) ?? 0,
    isActive: parseBoolean(row.isActive, true),
    isPublic: parseBoolean(row.isPublic, true),
  };
  assignIfDefined(item, "description", normalizeCell(row.description));
  assignIfDefined(item, "priceCents", parseOptionalInteger(row.priceCents));
  assignIfDefined(item, "priceLabel", normalizeCell(row.priceLabel));
  assignIfDefined(
    item,
    "durationMinutes",
    parseOptionalInteger(row.durationMinutes),
  );
  assignIfDefined(item, "bookingUrl", normalizeCell(row.bookingUrl));

  if (tags.length) {
    item.tags = tags;
    item.keywords = tags.join(" ");
  }

  return item;
}

function assignIfDefined<T extends keyof ServiceItemFormInput>(
  item: ServiceItemFormInput,
  key: T,
  value: ServiceItemFormInput[T] | undefined,
) {
  if (value !== undefined) {
    item[key] = value;
  }
}

function normalizeCell(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseServiceType(value: string | undefined): RestaurantServiceType {
  const normalized = normalizeCell(value);
  return serviceTypes.includes(normalized as RestaurantServiceType)
    ? (normalized as RestaurantServiceType)
    : "general";
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

function validateServiceItemImportRow(
  item: ServiceItemFormInput,
  row: CsvRow,
  line: number,
) {
  const errors: string[] = [];

  if (!item.name) {
    errors.push(`第 ${line} 列：name 必填。`);
  }

  const rawServiceType = normalizeCell(row.serviceType);
  if (
    rawServiceType &&
    !serviceTypes.includes(rawServiceType as RestaurantServiceType)
  ) {
    errors.push(
      `第 ${line} 列：serviceType 必須是 ${serviceTypes.join("、")}。`,
    );
  }

  if (!isOptionalIntegerInRange(item.priceCents, 0)) {
    errors.push(`第 ${line} 列：priceCents 必須是 0 以上整數。`);
  }

  if (!isOptionalIntegerInRange(item.durationMinutes, 1, 1440)) {
    errors.push(`第 ${line} 列：durationMinutes 必須是 1 到 1440 的整數。`);
  }

  if (!isOptionalIntegerInRange(item.sortOrder, 0, 1000)) {
    errors.push(`第 ${line} 列：sortOrder 必須是 0 到 1000 的整數。`);
  }

  if (item.bookingUrl && !isValidUrl(item.bookingUrl)) {
    errors.push(`第 ${line} 列：bookingUrl 必須是有效 URL。`);
  }

  return errors;
}

function isOptionalIntegerInRange(
  value: number | null | undefined,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value === null || value === undefined) return true;
  return Number.isInteger(value) && value >= min && value <= max;
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
