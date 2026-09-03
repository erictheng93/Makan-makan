const QUOTE_REQUIRED = /[",\n\r]/;
const FORMULA_LEAD = /^[=+\-@\t\r\n]/;
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);
  const neutralized =
    FORMULA_LEAD.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;

  return QUOTE_REQUIRED.test(neutralized)
    ? `"${neutralized.replaceAll('"', '""')}"`
    : neutralized;
}

export function toCsv(rows: ReadonlyArray<readonly unknown[]>): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}
