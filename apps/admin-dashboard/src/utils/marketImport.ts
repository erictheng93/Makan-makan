import Papa from "papaparse";
import type { CreateMarketInput } from "@/services/marketsService";

export type MarketImportFormat = "csv" | "json";

export interface MarketImportParseResult {
  markets: CreateMarketInput[];
  errors: string[];
}

const csvFields = [
  "slug",
  "name",
  "type",
  "city",
  "district",
  "address",
  "latitude",
  "longitude",
  "description",
  "bannerUrl",
  "logoUrl",
  "imageUrls",
  "tags",
  "isActive",
] as const;

type CsvField = (typeof csvFields)[number];
type CsvRow = Record<CsvField, string | undefined>;

const marketTypes = new Set([
  "night_market",
  "commercial_district",
  "food_court",
  "event_venue",
]);
type MarketType = CreateMarketInput["type"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildMarketImportTemplate() {
  return [
    csvFields.join(","),
    [
      "fengjia",
      "逢甲夜市",
      "night_market",
      "台中市",
      "西屯區",
      "台中市西屯區文華路",
      "24.176",
      "120.646",
      "台中指標夜市商圈",
      "",
      "",
      "",
      '"夜市,小吃"',
      "true",
    ].join(","),
  ].join("\n");
}

export function buildMarketImportRetryText(
  format: MarketImportFormat,
  markets: CreateMarketInput[],
) {
  if (format === "json") {
    return JSON.stringify(markets, null, 2);
  }

  return Papa.unparse(
    markets.map((market) => marketToCsvRow(market)),
    {
      columns: [...csvFields],
    },
  );
}

export function parseMarketImport(
  format: MarketImportFormat,
  text: string,
): MarketImportParseResult {
  if (!text.trim()) {
    return { markets: [], errors: ["請貼上要匯入的市場資料。"] };
  }

  if (format === "json") {
    return parseJsonImport(text);
  }

  return parseCsvImport(text);
}

function parseJsonImport(text: string): MarketImportParseResult {
  try {
    const payload: unknown = JSON.parse(text);
    const markets = Array.isArray(payload)
      ? payload
      : isMarketImportEnvelope(payload)
        ? payload.markets
        : null;

    if (!markets?.length) {
      return { markets: [], errors: ["請貼上至少一筆市場資料。"] };
    }

    if (
      markets.some((market) => typeof market !== "object" || market === null)
    ) {
      return {
        markets: [],
        errors: ["每一筆市場資料都必須是 JSON 物件。"],
      };
    }

    const errors: string[] = [];
    const inputs: CreateMarketInput[] = [];
    const seenSlugs = new Map<string, number>();
    markets.forEach((market, index) => {
      const line = index + 1;
      const input = market as CreateMarketInput;
      const rowErrors = validateMarketImportRow(input, line);
      rowErrors.push(...validateUniqueSlug(input.slug, line, seenSlugs));
      errors.push(...rowErrors);
      if (rowErrors.length === 0) {
        inputs.push(input);
      }
    });

    return {
      markets: errors.length > 0 ? [] : inputs,
      errors,
    };
  } catch {
    return { markets: [], errors: ["市場 JSON 格式不正確。"] };
  }
}

function isMarketImportEnvelope(
  value: unknown,
): value is { markets: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { markets?: unknown }).markets)
  );
}

function parseCsvImport(text: string): MarketImportParseResult {
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
  const markets: CreateMarketInput[] = [];
  const seenSlugs = new Map<string, number>();

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const market = csvRowToMarket(row);
    const rowErrors = validateMarketImportRow(market, line);
    rowErrors.push(...validateUniqueSlug(market.slug, line, seenSlugs));
    errors.push(...rowErrors);
    if (rowErrors.length === 0) {
      markets.push(market);
    }
  });

  if (markets.length === 0 && errors.length === 0) {
    errors.push("請貼上至少一筆市場資料。");
  }

  return {
    markets: errors.length > 0 ? [] : markets,
    errors,
  };
}

function csvRowToMarket(row: CsvRow): CreateMarketInput {
  const market: Partial<CreateMarketInput> = {};
  for (const field of csvFields) {
    const value = normalizeCell(row[field]);
    if (value === undefined) continue;

    if (field === "latitude" || field === "longitude") {
      market[field] = Number(value);
    } else if (field === "isActive") {
      market.isActive = parseBoolean(value);
    } else if (field === "tags" || field === "imageUrls") {
      market[field] = parseList(value);
    } else if (field === "type") {
      market.type = value as MarketType;
    } else {
      market[field] = value;
    }
  }
  return market as CreateMarketInput;
}

function marketToCsvRow(market: CreateMarketInput): CsvRow {
  const row = {} as CsvRow;
  for (const field of csvFields) {
    const value = market[field];
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      row[field] = value.join(",");
    } else {
      row[field] = String(value);
    }
  }
  return row;
}

function normalizeCell(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolean(value: string) {
  return ["true", "1", "yes", "y", "是"].includes(value.toLowerCase());
}

function parseList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateMarketImportRow(market: CreateMarketInput, line: number) {
  const errors: string[] = [];
  if (market.slug && !slugPattern.test(market.slug)) {
    errors.push(`第 ${line} 列：slug 只能使用小寫英數與連字號。`);
  }

  const requiredFields: Array<keyof CreateMarketInput> = [
    "slug",
    "name",
    "type",
    "city",
    "district",
    "address",
  ];

  for (const field of requiredFields) {
    if (!market[field]) {
      errors.push(`第 ${line} 列：${field} 為必填。`);
    }
  }
  if (market.type && !marketTypes.has(market.type)) {
    errors.push(`第 ${line} 列：type 不支援。`);
  }
  if (!isCoordinate(market.latitude, -90, 90)) {
    errors.push(`第 ${line} 列：latitude 必須是 -90 到 90 之間的數字。`);
  }
  if (!isCoordinate(market.longitude, -180, 180)) {
    errors.push(`第 ${line} 列：longitude 必須是 -180 到 180 之間的數字。`);
  }

  return errors;
}

function validateUniqueSlug(
  slug: string | undefined,
  line: number,
  seenSlugs: Map<string, number>,
) {
  if (!slug || !slugPattern.test(slug)) {
    return [];
  }

  const firstLine = seenSlugs.get(slug);
  if (firstLine !== undefined) {
    return [
      `第 ${line} 列：slug 與第 ${firstLine} 列重複，請確認每個市場 slug 唯一。`,
    ];
  }

  seenSlugs.set(slug, line);
  return [];
}

function isCoordinate(value: unknown, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
