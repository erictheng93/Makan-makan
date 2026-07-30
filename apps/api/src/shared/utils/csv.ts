/**
 * CSV serialization helpers shared by every CSV export route.
 *
 * Two separate concerns live here so no individual export has to remember them:
 *
 * 1. RFC 4180 quoting — a cell containing `"`, `,`, CR or LF is wrapped in
 *    double quotes and embedded quotes are doubled. Without this, a vendor name
 *    with a comma silently shifts every following column.
 * 2. Formula-injection neutralization (a.k.a. CSV injection) — Excel, Google
 *    Sheets and LibreOffice evaluate a cell that begins with `=`, `+`, `-`, `@`,
 *    TAB or CR as a formula when the downloaded file is opened. Vendor names,
 *    market names and order numbers are free text, so an operator opening a
 *    settlement export would execute whatever a tenant typed into its own name.
 *    Per OWASP we prefix such a cell with a single quote, which forces the
 *    spreadsheet to treat the content as literal text.
 *
 * Plain numeric literals are deliberately exempt from (2): `-500` and `+1.5e3`
 * are numbers, not formulas, and prefixing them would turn the amount columns of
 * the accounting/settlement exports into text cells for every consumer.
 */

const QUOTE_REQUIRED = /[",\n\r]/;
const FORMULA_LEAD = /^[=+\-@\t\r\n]/;
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Serialize a single cell: formula-neutralized, then RFC 4180 quoted. */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);
  const neutralized =
    FORMULA_LEAD.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;

  return QUOTE_REQUIRED.test(neutralized)
    ? `"${neutralized.replaceAll('"', '""')}"`
    : neutralized;
}

/** Serialize one row of cells. */
export function toCsvRow(values: readonly unknown[]): string {
  return values.map(escapeCsvValue).join(",");
}

/** Serialize a header row plus data rows into a CSV document. */
export function toCsv(rows: ReadonlyArray<readonly unknown[]>): string {
  return rows.map(toCsvRow).join("\n");
}
