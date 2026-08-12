import { describe, expect, it, vi } from "vitest";
import type { PrintContent, PrinterDevice } from "@makanmasak/shared-types";
import { EpsonDriver } from "./EpsonDriver";
import { PrinterDriverFactory } from "./PrinterDriverFactory";
import { PrinterService } from "../services/PrinterService";

const device: PrinterDevice = {
  id: "printer-1",
  name: "EPSON TM-T20",
  brand: "epson",
  model: "TM-T20",
  connection: "network",
  address: "192.0.2.10:9100",
  status: "offline",
  capabilities: {
    maxWidth: 32,
    supportsGraphics: true,
    supportsCutter: true,
    supportsDrawer: true,
    supportsQRCode: true,
    supportsBarcode: true,
    supportedEncodings: ["utf8"],
    paperSizes: [],
  },
  lastSeen: new Date(),
  isDefault: false,
};

const content: PrintContent = {
  header: {
    restaurantInfo: {
      name: "MakanMasak",
      address: "Taipei",
      phone: "02-1234-5678",
      taxNumber: "12345678",
    },
    transactionInfo: {
      orderId: "order-123",
      cashier: "System",
      timestamp: new Date("2026-08-12T00:00:00.000Z"),
      receiptNumber: "receipt-123",
    },
  },
  items: [],
  summary: { subtotal: 0, tax: [], total: 0, payment: [], change: 0 },
  footer: { thankYouMessage: "Thank you" },
};

class RetryingEpsonDriver extends EpsonDriver {
  attempts = 0;

  protected override async sendCommands(): Promise<void> {
    this.attempts += 1;
    if (this.attempts < 3) throw new Error("temporary transport failure");
  }
}

class SlowEpsonDriver extends EpsonDriver {
  protected override async sendCommands(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("PrinterDriver execution options", () => {
  it("retries a failed printer command the configured number of times", async () => {
    const driver = new RetryingEpsonDriver(device, {
      retryAttempts: 2,
      commandTimeout: 100,
    });
    await driver.connect();

    await expect(driver.print(content)).resolves.toMatchObject({
      success: true,
    });
    expect(driver.attempts).toBe(3);
  });

  it("fails a command that exceeds the configured timeout", async () => {
    const driver = new SlowEpsonDriver(device, {
      retryAttempts: 0,
      commandTimeout: 5,
    });
    await driver.connect();

    await expect(driver.print(content)).resolves.toMatchObject({
      success: false,
      error: { code: "PRINT_FAILED" },
    });
  });

  it("forwards the service driver policy when registering a printer", async () => {
    const driver = new EpsonDriver(device);
    const createDriver = vi
      .spyOn(PrinterDriverFactory, "createDriver")
      .mockResolvedValue(driver);
    const service = new PrinterService({
      drivers: {
        connectionTimeout: 111,
        commandTimeout: 222,
        heartbeatInterval: 333,
        retryAttempts: 4,
      },
    });

    await service.registerPrinter({
      id: device.id,
      brand: device.brand,
      model: device.model,
      connectionType: device.connection,
      connectionParams: { host: "192.0.2.10", port: 9100 },
    });

    expect(createDriver).toHaveBeenCalledWith(
      device.brand,
      expect.any(Object),
      expect.objectContaining({
        connectionTimeout: 111,
        commandTimeout: 222,
        retryAttempts: 4,
      }),
    );
    await service.unregisterPrinter(device.id);
  });
});
