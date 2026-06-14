import { describe, expect, it } from "vitest";
import { ESCPOSCommands } from "./ESCPOSCommands";

describe("ESCPOSCommands", () => {
  it("builds text layout helpers used by receipt printers", () => {
    expect(ESCPOSCommands.lineFeed(3)).toBe("\x0A\x0A\x0A");
    expect(ESCPOSCommands.textLine("Subtotal")).toBe("Subtotal\x0A");
    expect(ESCPOSCommands.separator("-", 8)).toBe("--------\x0A");
    expect(ESCPOSCommands.textColumns("Subtotal:", "250.00", 20)).toBe(
      "Subtotal:     250.00\x0A",
    );
  });

  it("builds hardware control commands", () => {
    expect(ESCPOSCommands.openDrawer()).toBe("\x1Bp\x00<<");
    expect(ESCPOSCommands.buzzer(2, 4)).toBe("\x1BB\x02\x04");
    expect(ESCPOSCommands.cutPaper("partial")).toBe("\x1DV\x01");
  });

  it("supports richer text modes and composite total lines", () => {
    expect(ESCPOSCommands.setUnderline("double")).toBe("\x1B-\x02");
    expect(ESCPOSCommands.printTotal("TOTAL:", "262.50", 20)).toBe(
      "\x1BE\x01\x1D!\x01TOTAL:        262.50\x0A\x1D!\x00\x1BE\x00",
    );
  });

  it("builds QR code commands with error correction level", () => {
    const command = ESCPOSCommands.qrCode("receipt-123", 4, "H");

    expect(command).toContain("\x1D(k\x03\x001E3");
    expect(command).toContain("receipt-123");
    expect(command.endsWith("\x1D(k\x03\x001Q0")).toBe(true);
  });
});
