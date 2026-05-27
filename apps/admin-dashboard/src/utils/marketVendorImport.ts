import Papa from "papaparse";
import type { ImportMarketVendorInput } from "@/services/marketsService";

export type MarketVendorImportFormat = "csv" | "json";

export interface MarketVendorImportParseResult {
  vendors: ImportMarketVendorInput[];
  errors: string[];
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
  "isPrimary",
] as const;

type CsvField = (typeof csvFields)[number];
type CsvRow = Record<CsvField, string | undefined>;

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
      "false",
    ].join(","),
  ].join("\n");
}

export function parseMarketVendorImport(
  format: MarketVendorImportFormat,
  text: string,
): MarketVendorImportParseResult {
  if (!text.trim()) {
    return { vendors: [], errors: ["請貼上要匯入的店鋪資料。"] };
  }

  if (format === "json") {
    return parseJsonImport(text);
  }

  return parseCsvImport(text);
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

    return { vendors: vendors as ImportMarketVendorInput[], errors: [] };
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

function parseCsvImport(text: string): MarketVendorImportParseResult {
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

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const vendor = csvRowToVendor(row);
    const rowErrors = validateVendorImportRow(vendor, line);
    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      vendors.push(vendor);
    }
  });

  if (vendors.length === 0 && errors.length === 0) {
    errors.push("請貼上至少一筆店鋪資料。");
  }

  return {
    vendors: errors.length > 0 ? [] : vendors,
    errors,
  };
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

function validateVendorImportRow(
  vendor: ImportMarketVendorInput,
  line: number,
) {
  const errors: string[] = [];
  if (!vendor.restaurantId) {
    if (!vendor.name || !vendor.address || !vendor.district) {
      errors.push(`第 ${line} 列：新店鋪需要 name、address、district。`);
    }
  }

  if (vendor.phone && !phonePattern.test(vendor.phone)) {
    errors.push(`第 ${line} 列：phone 只能包含數字、空白、+、-、括號。`);
  }
  if (
    typeof vendor.latitude === "number" &&
    !isCoordinate(vendor.latitude, -90, 90)
  ) {
    errors.push(`第 ${line} 列：latitude 必須是 -90 到 90 之間的數字。`);
  }
  if (
    typeof vendor.longitude === "number" &&
    !isCoordinate(vendor.longitude, -180, 180)
  ) {
    errors.push(`第 ${line} 列：longitude 必須是 -180 到 180 之間的數字。`);
  }

  return errors;
}

function isCoordinate(
  value: number | undefined,
  minimum: number,
  maximum: number,
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}
