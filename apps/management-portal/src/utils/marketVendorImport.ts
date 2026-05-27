import type { MarketVendorImportInput } from "@/types";

export interface MarketVendorImportParseResult {
  vendors: MarketVendorImportInput[];
  errors: string[];
}

const requiredHeaders = new Set(["restaurantId", "name"]);
const allowedHeaders = new Set([
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
]);

export function buildMarketVendorImportTemplate() {
  return [
    "restaurantId,name,address,district,city,stallNumber,isPrimary,phone,email,latitude,longitude",
    ",逢甲雞排攤,台中市西屯區文華路100號,西屯區,台中市,A-18,true,0423456789,stall@example.com,24.179001,120.646001",
    "restaurant-123,,,,,B-02,false,,,,",
  ].join("\n");
}

export function parseMarketVendorImport(
  value: string,
): MarketVendorImportParseResult {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { vendors: [], errors: ["CSV is empty"] };

  const headers = parseCsvLine(lines[0]);
  const errors: string[] = [];
  const vendors: MarketVendorImportInput[] = [];

  for (const header of headers) {
    if (!allowedHeaders.has(header)) {
      errors.push(`Unknown header: ${header}`);
    }
  }
  if (!headers.some((header) => requiredHeaders.has(header))) {
    errors.push("CSV must include restaurantId or name");
  }

  for (const [lineIndex, line] of lines.slice(1).entries()) {
    const rowNumber = lineIndex + 2;
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, cells[index]?.trim() ?? ""]),
    );
    const vendor = rowToVendor(row);
    if (!vendor.restaurantId && !vendor.name) {
      errors.push(`Row ${rowNumber}: restaurantId or name is required`);
      continue;
    }
    vendors.push(vendor);
  }

  if (vendors.length === 0) errors.push("CSV has no importable vendors");

  return { vendors, errors };
}

function rowToVendor(row: Record<string, string>): MarketVendorImportInput {
  return {
    ...assignString(row, "restaurantId"),
    ...assignString(row, "name"),
    ...assignString(row, "type"),
    ...assignString(row, "category"),
    ...assignString(row, "description"),
    ...assignString(row, "address"),
    ...assignString(row, "district"),
    ...assignString(row, "city"),
    ...assignNumber(row, "latitude"),
    ...assignNumber(row, "longitude"),
    ...assignString(row, "phone"),
    ...assignString(row, "email"),
    ...assignString(row, "website"),
    stallNumber: row.stallNumber?.trim() || null,
    ...assignBoolean(row, "isPrimary"),
  };
}

function assignString(
  row: Record<string, string>,
  key: keyof MarketVendorImportInput,
) {
  const value = row[key]?.trim();
  return value ? { [key]: value } : {};
}

function assignNumber(
  row: Record<string, string>,
  key: "latitude" | "longitude",
) {
  const value = row[key]?.trim();
  if (!value) return {};
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? { [key]: numberValue } : {};
}

function assignBoolean(row: Record<string, string>, key: "isPrimary") {
  const value = row[key]?.trim().toLowerCase();
  if (!value) return {};
  return { [key]: ["1", "true", "yes", "y"].includes(value) };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += char;
  }

  cells.push(cell);
  return cells;
}
