import Papa from "papaparse";
import type { ImportMarketVendorInput } from "@/services/marketsService";

export type MarketVendorImportFormat = "csv" | "json";

export interface MarketVendorImportParseResult {
  vendors: ImportMarketVendorInput[];
  errors: string[];
}

export interface MarketVendorImportParseOptions {
  marketId?: string;
  marketSlug?: string;
}

const csvFields = [
  "restaurantId",
  "name",
  "type",
  "category",
  "description",
  "address",
  "district",
  "city",
  "latitude",
  "longitude",
  "phone",
  "email",
  "website",
  "stallNumber",
  "locationLabel",
  "mapX",
  "mapY",
  "isPrimary",
] as const;
const worklistContextFields = ["marketId", "marketSlug"] as const;

type CsvField = (typeof csvFields)[number];
type WorklistContextField = (typeof worklistContextFields)[number];
type CsvRow = Record<CsvField | WorklistContextField, string | undefined>;

const phonePattern = /^[\d\s\-+()]+$/;

export function buildMarketVendorImportTemplate() {
  return [
    csvFields.join(","),
    [
      "restaurant-1",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "A-01",
      "文華路入口",
      "20",
      "35",
      "true",
    ].join(","),
    [
      "",
      "新店鋪",
      "market_stall",
      "food",
      "招牌小吃攤",
      "台中市西屯區文華路 100 號",
      "西屯區",
      "台中市",
      "24.176",
      "120.646",
      "0222222222",
      "",
      "",
      "B-02",
      "福星路轉角",
      "62",
      "58",
      "false",
    ].join(","),
  ].join("\n");
}

export function parseMarketVendorImport(
  format: MarketVendorImportFormat,
  text: string,
  options: MarketVendorImportParseOptions = {},
): MarketVendorImportParseResult {
  if (!text.trim()) {
    return { vendors: [], errors: ["請貼上要匯入的店鋪資料。"] };
  }

  if (format === "json") {
    return parseJsonImport(text);
  }

  return parseCsvImport(text, options);
}

function parseJsonImport(text: string): MarketVendorImportParseResult {
  try {
    const payload: unknown = JSON.parse(text);
    const vendors = Array.isArray(payload)
      ? payload
      : isVendorImportEnvelope(payload)
        ? payload.vendors
        : null;

    if (!vendors?.length) {
      return { vendors: [], errors: ["請貼上至少一筆店鋪資料。"] };
    }

    if (
      vendors.some((vendor) => typeof vendor !== "object" || vendor === null)
    ) {
      return {
        vendors: [],
        errors: ["每一筆店鋪資料都必須是 JSON 物件。"],
      };
    }

    return validateVendorImportRows(
      vendors as ImportMarketVendorInput[],
      (index) => `第 ${index + 1} 筆`,
    );
  } catch {
    return { vendors: [], errors: ["店鋪 JSON 格式不正確。"] };
  }
}

function isVendorImportEnvelope(
  value: unknown,
): value is { vendors: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { vendors?: unknown }).vendors)
  );
}

function parseCsvImport(
  text: string,
  options: MarketVendorImportParseOptions,
): MarketVendorImportParseResult {
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
  const vendors: ImportMarketVendorInput[] = [];
  const hasWorklistContext = parsed.meta.fields?.some((field) =>
    worklistContextFields.includes(field as WorklistContextField),
  );
  let matchedWorklistRows = 0;

  parsed.data.forEach((row, index) => {
    if (hasWorklistContext && optionsHasMarketContext(options)) {
      if (!rowMatchesTargetMarket(row, options)) return;
      matchedWorklistRows += 1;
    }

    const vendor = csvRowToVendor(row);
    const rowErrors = validateVendorImportRow(vendor, `第 ${index + 2} 列`);
    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      vendors.push(vendor);
    }
  });

  if (
    hasWorklistContext &&
    optionsHasMarketContext(options) &&
    matchedWorklistRows === 0 &&
    errors.length === 0
  ) {
    errors.push("這份店鋪 worklist 沒有符合目前市場的列。");
  }

  if (vendors.length === 0 && errors.length === 0) {
    errors.push("請貼上至少一筆店鋪資料。");
  }

  return {
    vendors: errors.length > 0 ? [] : vendors,
    errors,
  };
}

function optionsHasMarketContext(options: MarketVendorImportParseOptions) {
  return Boolean(options.marketId || options.marketSlug);
}

function rowMatchesTargetMarket(
  row: CsvRow,
  options: MarketVendorImportParseOptions,
) {
  const rowMarketId = normalizeCell(row.marketId);
  const rowMarketSlug = normalizeCell(row.marketSlug);

  return (
    (rowMarketId && rowMarketId === options.marketId) ||
    (rowMarketSlug && rowMarketSlug === options.marketSlug)
  );
}

function csvRowToVendor(row: CsvRow): ImportMarketVendorInput {
  const vendor: ImportMarketVendorInput = {};
  for (const field of csvFields) {
    const value = normalizeCell(row[field]);
    if (value === undefined) continue;

    if (field === "isPrimary") {
      vendor.isPrimary = parseBoolean(value);
    } else if (field === "latitude" || field === "longitude") {
      vendor[field] = Number(value);
    } else if (field === "mapX" || field === "mapY") {
      const axis = field === "mapX" ? "x" : "y";
      vendor.mapPosition = {
        ...(vendor.mapPosition ?? { x: 0, y: 0 }),
        [axis]: Number(value),
      };
    } else {
      vendor[field] = value;
    }
  }
  return vendor;
}

function normalizeCell(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolean(value: string) {
  return ["true", "1", "yes", "y", "是"].includes(value.toLowerCase());
}

function validateVendorImportRows(
  vendors: ImportMarketVendorInput[],
  rowLabel: (index: number) => string,
): MarketVendorImportParseResult {
  const errors: string[] = [];
  const validVendors: ImportMarketVendorInput[] = [];

  vendors.forEach((vendor, index) => {
    const rowErrors = validateVendorImportRow(vendor, rowLabel(index));
    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      validVendors.push(vendor);
    }
  });

  return {
    vendors: errors.length > 0 ? [] : validVendors,
    errors,
  };
}

function validateVendorImportRow(
  vendor: ImportMarketVendorInput,
  rowLabel: string,
) {
  const errors: string[] = [];
  if (!vendor.restaurantId) {
    if (!vendor.name || !vendor.address || !vendor.district) {
      errors.push(`${rowLabel}：新店鋪需要 name、address、district。`);
    }
  }

  if (vendor.phone && !phonePattern.test(vendor.phone)) {
    errors.push(`${rowLabel}：phone 只能包含數字、空白、+、-、括號。`);
  }
  if (
    vendor.latitude !== undefined &&
    !isCoordinate(vendor.latitude, -90, 90)
  ) {
    errors.push(`${rowLabel}：latitude 必須是 -90 到 90 之間的數字。`);
  }
  if (
    vendor.longitude !== undefined &&
    !isCoordinate(vendor.longitude, -180, 180)
  ) {
    errors.push(`${rowLabel}：longitude 必須是 -180 到 180 之間的數字。`);
  }
  if (vendor.mapPosition !== undefined) {
    if (
      !isCoordinate(vendor.mapPosition?.x, 0, 100) ||
      !isCoordinate(vendor.mapPosition?.y, 0, 100)
    ) {
      errors.push(`${rowLabel}：mapX/mapY 必須是 0 到 100 之間的數字。`);
    }
  }

  return errors;
}

function isCoordinate(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}
