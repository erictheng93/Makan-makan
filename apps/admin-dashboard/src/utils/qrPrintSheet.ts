import QRCode from "qrcode";

/**
 * Builds the printable QR sheet used for table and seat stickers.
 *
 * Extracted so both the table setup grid and seat management render the same
 * sheet, and so the layout can be unit tested. It matters for the #88 phase-2
 * rollout: re-stickering a venue means printing every code at once, and a sheet
 * that silently drops or overlaps cards across page boundaries is not something
 * you want to discover after handing a shop owner their stickers.
 */

export interface PrintableQRCode {
  label: string;
  dataUrl: string;
}

/** QR bitmap size, in px, used for both rendering and the printed image box. */
export const QR_PRINT_SIZE = 220;

const SHEET_STYLE = [
  // A4 with real margins rather than viewport units: print output must not
  // depend on the window the operator happened to have open.
  "@page{size:A4;margin:12mm}",
  "body{margin:0;color:#111827;font-family:system-ui,-apple-system,sans-serif}",
  "h1{margin:0 0 16px;text-align:center;font-size:24px}",
  ".qr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}",
  // break-inside keeps a label attached to its QR across a page boundary.
  ".qr-card{break-inside:avoid;page-break-inside:avoid;display:flex;flex-direction:column;align-items:center;border:1px solid #d1d5db;border-radius:12px;padding:16px}",
  ".qr-card h2{margin:0 0 10px;font-size:18px}",
  `.qr-card img{display:block;width:${QR_PRINT_SIZE}px;height:${QR_PRINT_SIZE}px}`,
].join("");

/** Encode one QR payload to a PNG data URL at print resolution. */
export function toPrintableDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: QR_PRINT_SIZE,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/**
 * Render the sheet into an already-opened window.
 *
 * Returns the number of cards written so callers can assert they printed what
 * they meant to, rather than silently producing an empty sheet.
 */
export function renderQRCodePrintSheet(
  printWindow: Window,
  title: string,
  qrCodes: PrintableQRCode[],
): number {
  const doc = printWindow.document;
  // Clear before setting the title: assigning doc.title creates a <title>
  // element in the head, so wiping the head afterwards would discard it.
  doc.head.replaceChildren();
  doc.body.replaceChildren();
  doc.title = title;

  const style = doc.createElement("style");
  style.textContent = SHEET_STYLE;
  doc.head.appendChild(style);

  const heading = doc.createElement("h1");
  heading.textContent = title;
  doc.body.appendChild(heading);

  const grid = doc.createElement("main");
  grid.className = "qr-grid";
  for (const qrCode of qrCodes) {
    const card = doc.createElement("section");
    card.className = "qr-card";

    const label = doc.createElement("h2");
    label.textContent = qrCode.label;
    card.appendChild(label);

    const image = doc.createElement("img");
    image.src = qrCode.dataUrl;
    image.alt = qrCode.label;
    card.appendChild(image);

    grid.appendChild(card);
  }
  doc.body.appendChild(grid);

  return qrCodes.length;
}

/**
 * Open a window, render the sheet, and trigger printing.
 *
 * Returns false when the popup was blocked or there is nothing to print, so the
 * caller can surface that instead of appearing to succeed. The print call is
 * deferred to let the browser decode the embedded images first — printing
 * immediately can produce a sheet of blank boxes.
 */
export function printQRCodeSheet(
  title: string,
  qrCodes: PrintableQRCode[],
  openWindow: () => Window | null = () => window.open("", "_blank"),
): boolean {
  if (qrCodes.length === 0) return false;

  const printWindow = openWindow();
  if (!printWindow) return false;

  return printQRCodeSheetInWindow(printWindow, title, qrCodes);
}

/**
 * Render and print a sheet in a window opened during the user's click.
 *
 * Callers that need to encode QR data asynchronously should open the window
 * before their first await, then pass it here once the data URLs are ready.
 */
export function printQRCodeSheetInWindow(
  printWindow: Window,
  title: string,
  qrCodes: PrintableQRCode[],
): boolean {
  if (qrCodes.length === 0) return false;

  renderQRCodePrintSheet(printWindow, title, qrCodes);
  setTimeout(() => printWindow.print(), 300);
  return true;
}
