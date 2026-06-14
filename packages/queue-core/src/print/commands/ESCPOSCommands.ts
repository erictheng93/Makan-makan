/**
 * ESC/POS Command Builder
 * Utility for building thermal printer command byte strings.
 */

export class ESCPOSCommands {
  private static readonly ESC = "\x1B";
  private static readonly GS = "\x1D";
  private static readonly LF = "\x0A";

  /**
   * Initialize printer
   */
  static initialize(): string {
    return ESCPOSCommands.ESC + "@";
  }

  /**
   * Reset printer settings
   */
  static reset(): string {
    return ESCPOSCommands.initialize();
  }

  /**
   * Print text
   */
  static printText(text: string): string {
    return text + ESCPOSCommands.LF;
  }

  /**
   * Print text with line feed
   */
  static printLine(text: string): string {
    return ESCPOSCommands.textLine(text);
  }

  /**
   * Output text without adding line feed
   */
  static text(text: string): string {
    return text;
  }

  /**
   * Output text followed by line feed
   */
  static textLine(text: string): string {
    return text + ESCPOSCommands.LF;
  }

  /**
   * Print one or more line feeds
   */
  static lineFeed(lines = 1): string {
    return ESCPOSCommands.LF.repeat(Math.max(0, lines));
  }

  /**
   * Build a separator line
   */
  static separator(char = "-", width = 32): string {
    return ESCPOSCommands.textLine(char.repeat(width));
  }

  /**
   * Set text alignment
   */
  static setAlignment(alignment: "left" | "center" | "right"): string {
    const alignmentCodes = {
      left: 0,
      center: 1,
      right: 2,
    };
    return (
      ESCPOSCommands.ESC + "a" + String.fromCharCode(alignmentCodes[alignment])
    );
  }

  /**
   * Set text size
   */
  static setTextSize(width: number, height: number): string {
    const clampedWidth = ESCPOSCommands.clampByte(width, 1, 8);
    const clampedHeight = ESCPOSCommands.clampByte(height, 1, 8);
    const size = ((clampedWidth - 1) << 4) | (clampedHeight - 1);
    return ESCPOSCommands.GS + "!" + String.fromCharCode(size);
  }

  /**
   * Set bold text
   */
  static setBold(enabled: boolean): string {
    return ESCPOSCommands.ESC + "E" + String.fromCharCode(enabled ? 1 : 0);
  }

  /**
   * Set underline. Boolean input is kept for existing CommandBuilder callers.
   */
  static setUnderline(
    mode: boolean | "none" | "single" | "double" = "none",
  ): string {
    const underlineValue =
      mode === true || mode === "single" ? 1 : mode === "double" ? 2 : 0;
    return ESCPOSCommands.ESC + "-" + String.fromCharCode(underlineValue);
  }

  /**
   * Set inverse text mode
   */
  static setInvert(enabled: boolean): string {
    return ESCPOSCommands.GS + "B" + String.fromCharCode(enabled ? 1 : 0);
  }

  /**
   * Set character spacing
   */
  static setCharacterSpacing(spacing: number): string {
    return (
      ESCPOSCommands.ESC +
      " " +
      String.fromCharCode(ESCPOSCommands.clampByte(spacing))
    );
  }

  /**
   * Set line spacing
   */
  static setLineSpacing(spacing: number): string {
    return (
      ESCPOSCommands.ESC +
      "3" +
      String.fromCharCode(ESCPOSCommands.clampByte(spacing))
    );
  }

  /**
   * Cut paper
   */
  static cutPaper(mode: boolean | "full" | "partial" = "full"): string {
    const fullCut = mode === true || mode === "full";
    return ESCPOSCommands.GS + "V" + String.fromCharCode(fullCut ? 0 : 1);
  }

  /**
   * Feed paper using ESC d
   */
  static feedPaper(lines: number): string {
    return (
      ESCPOSCommands.ESC +
      "d" +
      String.fromCharCode(ESCPOSCommands.clampByte(lines))
    );
  }

  /**
   * Open cash drawer
   */
  static openDrawer(connector = 0, pulseLength = 60): string {
    return (
      ESCPOSCommands.ESC +
      "p" +
      String.fromCharCode(
        ESCPOSCommands.clampByte(connector, 0, 1),
        ESCPOSCommands.clampByte(pulseLength),
        ESCPOSCommands.clampByte(pulseLength),
      )
    );
  }

  /**
   * Trigger printer buzzer
   */
  static buzzer(times = 1, duration = 3): string {
    return (
      ESCPOSCommands.ESC +
      "B" +
      String.fromCharCode(
        ESCPOSCommands.clampByte(times),
        ESCPOSCommands.clampByte(duration),
      )
    );
  }

  /**
   * Left/right aligned text columns
   */
  static textColumns(left: string, right: string, totalWidth = 32): string {
    const leftWidth = ESCPOSCommands.byteLength(left);
    const rightWidth = ESCPOSCommands.byteLength(right);
    const spacesNeeded = Math.max(0, totalWidth - leftWidth - rightWidth);

    return ESCPOSCommands.textLine(left + " ".repeat(spacesNeeded) + right);
  }

  /**
   * Three-column aligned text
   */
  static textThreeColumns(
    left: string,
    center: string,
    right: string,
    totalWidth = 32,
  ): string {
    const totalContentWidth =
      ESCPOSCommands.byteLength(left) +
      ESCPOSCommands.byteLength(center) +
      ESCPOSCommands.byteLength(right);
    const spacesAvailable = Math.max(0, totalWidth - totalContentWidth);
    const spacesLeft = Math.floor(spacesAvailable / 2);
    const spacesRight = spacesAvailable - spacesLeft;

    return ESCPOSCommands.textLine(
      left + " ".repeat(spacesLeft) + center + " ".repeat(spacesRight) + right,
    );
  }

  /**
   * Print barcode
   */
  static printBarcode(
    data: string,
    type: "CODE128" | "CODE39" | "EAN13" | "EAN8" = "CODE128",
  ): string {
    const barcodeTypes = {
      CODE128: 73,
      CODE39: 69,
      EAN13: 67,
      EAN8: 68,
    };

    return (
      ESCPOSCommands.GS +
      "k" +
      String.fromCharCode(barcodeTypes[type]) +
      String.fromCharCode(ESCPOSCommands.byteLength(data)) +
      data
    );
  }

  /**
   * Print Code 128 barcode with sizing and HRI options
   */
  static barcode128(
    data: string,
    height = 50,
    width: 1 | 2 | 3 | 4 | 5 | 6 = 2,
    showText = true,
  ): string {
    return (
      ESCPOSCommands.GS +
      "h" +
      String.fromCharCode(ESCPOSCommands.clampByte(height)) +
      ESCPOSCommands.GS +
      "w" +
      String.fromCharCode(width) +
      ESCPOSCommands.GS +
      "H" +
      String.fromCharCode(showText ? 2 : 0) +
      ESCPOSCommands.GS +
      "k" +
      "I" +
      String.fromCharCode(ESCPOSCommands.byteLength(data)) +
      data
    );
  }

  /**
   * Print QR code
   */
  static printQRCode(data: string, size: number = 3): string {
    return ESCPOSCommands.qrCode(
      data,
      ESCPOSCommands.clampByte(size, 1, 8) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    );
  }

  /**
   * Print QR code with error correction level
   */
  static qrCode(
    data: string,
    size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 3,
    errorCorrection: "L" | "M" | "Q" | "H" = "M",
  ): string {
    const dataLength = ESCPOSCommands.byteLength(data) + 3;
    const errorCorrectionLevel = {
      L: 0x30,
      M: 0x31,
      Q: 0x32,
      H: 0x33,
    }[errorCorrection];

    return (
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(4, 0, 49, 65, 50, 0) +
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(3, 0, 49, 67, size) +
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(3, 0, 49, 69, errorCorrectionLevel) +
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(dataLength % 256, Math.floor(dataLength / 256)) +
      "1P0" +
      data +
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(3, 0, 49, 81, 48)
    );
  }

  /**
   * Print simple monochrome image data
   */
  static printImage(
    imageData: boolean[][],
    alignment: "left" | "center" | "right" = "left",
  ): string {
    const height = imageData.length;
    const width = imageData[0]?.length || 0;
    const bytesPerLine = Math.ceil(width / 8);
    const commands: string[] = [
      ESCPOSCommands.setAlignment(alignment),
      ESCPOSCommands.ESC +
        "*" +
        String.fromCharCode(0, bytesPerLine & 0xff, (bytesPerLine >> 8) & 0xff),
    ];

    for (let y = 0; y < height; y++) {
      const lineData: number[] = [];
      for (let x = 0; x < bytesPerLine; x++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = x * 8 + bit;
          if (pixelX < width && imageData[y][pixelX]) {
            byte |= 1 << (7 - bit);
          }
        }
        lineData.push(byte);
      }
      commands.push(
        String.fromCharCode(...lineData),
        ESCPOSCommands.lineFeed(),
      );
    }

    return commands.join("");
  }

  /**
   * Print title text
   */
  static printTitle(title: string): string {
    return (
      ESCPOSCommands.setAlignment("center") +
      ESCPOSCommands.setBold(true) +
      ESCPOSCommands.setTextSize(2, 2) +
      ESCPOSCommands.textLine(title) +
      ESCPOSCommands.setTextSize(1, 1) +
      ESCPOSCommands.setBold(false) +
      ESCPOSCommands.setAlignment("left") +
      ESCPOSCommands.lineFeed()
    );
  }

  /**
   * Print subtotal row
   */
  static printSubtotal(label: string, amount: string, width = 32): string {
    return ESCPOSCommands.textColumns(label, amount, width);
  }

  /**
   * Print emphasized total row
   */
  static printTotal(label: string, amount: string, width = 32): string {
    return (
      ESCPOSCommands.setBold(true) +
      ESCPOSCommands.setTextSize(1, 2) +
      ESCPOSCommands.textColumns(label, amount, width) +
      ESCPOSCommands.setTextSize(1, 1) +
      ESCPOSCommands.setBold(false)
    );
  }

  /**
   * Print fixed-width table row
   */
  static printTableRow(columns: string[], widths: number[]): string {
    let row = "";

    for (let index = 0; index < columns.length; index++) {
      const column = columns[index] || "";
      const width = widths[index] || 0;
      const columnWidth = ESCPOSCommands.byteLength(column);

      if (columnWidth > width) {
        row += ESCPOSCommands.truncateToWidth(column, width);
      } else {
        row += column + " ".repeat(width - columnWidth);
      }
    }

    return ESCPOSCommands.textLine(row);
  }

  /**
   * Build complete command sequence
   */
  static buildSequence(commands: string[]): string {
    return commands.join("");
  }

  /**
   * Build printer test page
   */
  static printTestPage(): string {
    return ESCPOSCommands.buildSequence([
      ESCPOSCommands.initialize(),
      ESCPOSCommands.printTitle("TEST PAGE"),
      ESCPOSCommands.separator("=", 32),
      ESCPOSCommands.textLine("Normal Text"),
      ESCPOSCommands.setBold(true),
      ESCPOSCommands.textLine("Bold Text"),
      ESCPOSCommands.setBold(false),
      ESCPOSCommands.setUnderline("single"),
      ESCPOSCommands.textLine("Underlined Text"),
      ESCPOSCommands.setUnderline("none"),
      ESCPOSCommands.separator("-", 32),
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.textLine("Left Aligned"),
      ESCPOSCommands.setAlignment("center"),
      ESCPOSCommands.textLine("Center Aligned"),
      ESCPOSCommands.setAlignment("right"),
      ESCPOSCommands.textLine("Right Aligned"),
      ESCPOSCommands.setAlignment("left"),
      ESCPOSCommands.separator("-", 32),
      ESCPOSCommands.setTextSize(2, 1),
      ESCPOSCommands.textLine("Wide Text"),
      ESCPOSCommands.setTextSize(1, 2),
      ESCPOSCommands.textLine("Tall Text"),
      ESCPOSCommands.setTextSize(2, 2),
      ESCPOSCommands.textLine("Big Text"),
      ESCPOSCommands.setTextSize(1, 1),
      ESCPOSCommands.separator("=", 32),
      ESCPOSCommands.textLine("Test completed"),
      ESCPOSCommands.lineFeed(3),
      ESCPOSCommands.cutPaper(),
    ]);
  }

  /**
   * Printer status request
   */
  static getStatus(): string {
    return ESCPOSCommands.GS + "a" + "\xff";
  }

  /**
   * Paper status request
   */
  static getPaperStatus(): string {
    return ESCPOSCommands.GS + "r" + "\x01";
  }

  private static clampByte(value: number, min = 0, max = 255): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private static byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }

  private static truncateToWidth(value: string, width: number): string {
    let output = "";
    let outputWidth = 0;

    for (const char of value) {
      const charWidth = ESCPOSCommands.byteLength(char);
      if (outputWidth + charWidth > width) {
        break;
      }
      output += char;
      outputWidth += charWidth;
    }

    return output;
  }
}
