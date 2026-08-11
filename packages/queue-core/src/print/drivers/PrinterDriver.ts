/**
 * Base Printer Driver Interface
 * Defines the standard interface for all printer drivers
 */

import type {
  PrinterDevice,
  PrintContent,
  PrintResponse,
  PrinterStatus,
} from "@makanmasak/shared-types";

export interface IPrinterDriver {
  /**
   * Connect to the printer
   */
  connect(): Promise<boolean>;

  /**
   * Disconnect from the printer
   */
  disconnect(): Promise<void>;

  /**
   * Check if printer is connected
   */
  isConnected(): boolean;

  /**
   * Get current printer status
   */
  getStatus(): Promise<PrinterStatus>;

  /**
   * Print content to the printer
   */
  print(content: PrintContent): Promise<PrintResponse>;

  /**
   * Get printer device information
   */
  getDeviceInfo(): PrinterDevice;

  /**
   * Test printer connection
   */
  testConnection(): Promise<boolean>;

  /**
   * Reset printer to default state
   */
  reset(): Promise<void>;
}

export abstract class PrinterDriver implements IPrinterDriver {
  protected device: PrinterDevice;
  protected connected = false;

  constructor(device: PrinterDevice) {
    this.device = device;
  }

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract getStatus(): Promise<PrinterStatus>;
  abstract print(content: PrintContent): Promise<PrintResponse>;

  isConnected(): boolean {
    return this.connected;
  }

  getDeviceInfo(): PrinterDevice {
    return { ...this.device };
  }

  async testConnection(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status === "online";
    } catch {
      return false;
    }
  }

  async reset(): Promise<void> {
    if (this.connected) {
      await this.disconnect();
      await this.connect();
    }
  }
}
