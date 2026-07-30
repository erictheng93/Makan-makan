// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QR_PRINT_SIZE,
  printQRCodeSheet,
  renderQRCodePrintSheet,
  type PrintableQRCode,
} from "./qrPrintSheet";

function fakePrintWindow() {
  const doc = document.implementation.createHTMLDocument("blank");
  return {
    document: doc,
    print: vi.fn(),
  } as unknown as Window & { print: ReturnType<typeof vi.fn> };
}

function seats(count: number): PrintableQRCode[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `A1 — seat ${String(i + 1).padStart(2, "0")}`,
    dataUrl: `data:image/png;base64,seat${i}`,
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("renderQRCodePrintSheet", () => {
  it("writes one card per code, each pairing its label with its own image", () => {
    const win = fakePrintWindow();
    const codes = seats(10);

    const written = renderQRCodePrintSheet(win, "A1 seat QR codes", codes);

    expect(written).toBe(10);
    const cards = [...win.document.querySelectorAll(".qr-card")];
    expect(cards).toHaveLength(10);
    cards.forEach((card, i) => {
      expect(card.querySelector("h2")?.textContent).toBe(codes[i].label);
      const img = card.querySelector("img");
      expect(img?.getAttribute("src")).toBe(codes[i].dataUrl);
      // alt carries the label so a failed image still identifies its seat
      expect(img?.getAttribute("alt")).toBe(codes[i].label);
    });
  });

  it("keeps a card intact across a page boundary", () => {
    const win = fakePrintWindow();
    renderQRCodePrintSheet(win, "sheet", seats(24));

    const css = win.document.querySelector("style")?.textContent ?? "";
    // Without these a label can print on one page and its QR on the next,
    // which produces stickers nobody can match up.
    expect(css).toContain("break-inside:avoid");
    expect(css).toContain("page-break-inside:avoid");
  });

  it("sizes the page for paper rather than the operator's window", () => {
    const win = fakePrintWindow();
    renderQRCodePrintSheet(win, "sheet", seats(1));

    const css = win.document.querySelector("style")?.textContent ?? "";
    expect(css).toContain("@page{size:A4;margin:12mm}");
    expect(css).toContain(`width:${QR_PRINT_SIZE}px`);
    expect(css).not.toContain("100vh");
  });

  it("sets the document title so the print job is identifiable", () => {
    const win = fakePrintWindow();
    renderQRCodePrintSheet(win, "A1 seat QR codes", seats(2));

    expect(win.document.title).toBe("A1 seat QR codes");
    expect(win.document.querySelector("h1")?.textContent).toBe(
      "A1 seat QR codes",
    );
  });

  it("replaces previous content when rendered twice into one window", () => {
    const win = fakePrintWindow();
    renderQRCodePrintSheet(win, "first", seats(6));
    renderQRCodePrintSheet(win, "second", seats(2));

    expect(win.document.querySelectorAll(".qr-card")).toHaveLength(2);
    expect(win.document.querySelectorAll("style")).toHaveLength(1);
    expect(win.document.querySelectorAll("h1")).toHaveLength(1);
  });
});

describe("printQRCodeSheet", () => {
  it("prints after a delay so images can decode first", () => {
    vi.useFakeTimers();
    const win = fakePrintWindow();

    const ok = printQRCodeSheet("sheet", seats(3), () => win);

    expect(ok).toBe(true);
    expect(win.print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(win.print).toHaveBeenCalledOnce();
  });

  it("reports failure when the popup is blocked instead of appearing to work", () => {
    expect(printQRCodeSheet("sheet", seats(3), () => null)).toBe(false);
  });

  it("refuses to open a window for an empty sheet", () => {
    const openWindow = vi.fn(() => fakePrintWindow());
    expect(printQRCodeSheet("sheet", [], openWindow)).toBe(false);
    expect(openWindow).not.toHaveBeenCalled();
  });
});
