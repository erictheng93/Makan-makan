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

export interface PrinterDriverExecutionOptions {
  connectionTimeout?: number;
  commandTimeout?: number;
  retryAttempts?: number;
}

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
  protected readonly executionOptions: Required<PrinterDriverExecutionOptions>;

  constructor(
    device: PrinterDevice,
    options: PrinterDriverExecutionOptions = {},
  ) {
    this.device = device;
    this.executionOptions = {
      connectionTimeout: 10000,
      commandTimeout: 5000,
      retryAttempts: 3,
      ...options,
    };
  }

  protected async executeConnection<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.executeWithRetry(
      operation,
      this.executionOptions.connectionTimeout,
    );
  }

  protected async executeCommand<T>(operation: () => Promise<T>): Promise<T> {
    return this.executeWithRetry(
      operation,
      this.executionOptions.commandTimeout,
    );
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= this.executionOptions.retryAttempts;
      attempt += 1
    ) {
      try {
        return await this.withTimeout(operation(), timeout);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeout: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`Printer operation timed out after ${timeout}ms`),
              ),
            timeout,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
