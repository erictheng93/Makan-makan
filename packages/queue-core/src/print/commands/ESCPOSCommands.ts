/**
 * ESC/POS Command Builder
 * Utility for building ESC/POS printer commands
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
   * Print text
   */
  static printText(text: string): string {
    return text + ESCPOSCommands.LF;
  }

  /**
   * Print text with line feed
   */
  static printLine(text: string): string {
    return text + ESCPOSCommands.LF;
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
    const size = ((width - 1) << 4) | (height - 1);
    return ESCPOSCommands.GS + "!" + String.fromCharCode(size);
  }

  /**
   * Set bold text
   */
  static setBold(enabled: boolean): string {
    return ESCPOSCommands.ESC + "E" + String.fromCharCode(enabled ? 1 : 0);
  }

  /**
   * Set underline
   */
  static setUnderline(enabled: boolean): string {
    return ESCPOSCommands.ESC + "-" + String.fromCharCode(enabled ? 1 : 0);
  }

  /**
   * Cut paper
   */
  static cutPaper(full: boolean = true): string {
    return ESCPOSCommands.GS + "V" + String.fromCharCode(full ? 0 : 1);
  }

  /**
   * Feed paper
   */
  static feedPaper(lines: number): string {
    return ESCPOSCommands.ESC + "d" + String.fromCharCode(lines);
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
      String.fromCharCode(data.length) +
      data
    );
  }

  /**
   * Print QR code
   */
  static printQRCode(data: string, size: number = 3): string {
    // QR code model
    const modelCommand =
      ESCPOSCommands.GS + "(k" + String.fromCharCode(4, 0, 49, 65, 50, 0);

    // QR code size
    const sizeCommand =
      ESCPOSCommands.GS + "(k" + String.fromCharCode(3, 0, 49, 67, size);

    // QR code data
    const dataLength = data.length + 3;
    const dataCommand =
      ESCPOSCommands.GS +
      "(k" +
      String.fromCharCode(
        dataLength % 256,
        Math.floor(dataLength / 256),
        49,
        80,
        48,
      ) +
      data;

    // Print QR code
    const printCommand =
      ESCPOSCommands.GS + "(k" + String.fromCharCode(3, 0, 49, 81, 48);

    return modelCommand + sizeCommand + dataCommand + printCommand;
  }

  /**
   * Build complete command sequence
   */
  static buildSequence(commands: string[]): string {
    return commands.join("");
  }
}
