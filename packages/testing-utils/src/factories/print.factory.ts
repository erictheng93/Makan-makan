/**
 * Print Factory for Test Data Generation
 *
 * 提供打印系統（queue-core 和 print-agent）的測試數據工廠
 * 支援 PrintJob、PrinterDevice、PrintRequest 和 PrintServiceConfig
 */

import {
  BaseFactory,
  type FactoryOptions,
  randomString,
  randomUUID,
  randomNumber,
} from "./base.factory";

import type {
  PrintJob,
  PrinterDevice,
  PrintRequest,
  PrintServiceConfig,
  PrintContent,
  PrintOptions,
  PrintError,
  PrinterCapabilities,
} from "@makanmasak/shared-types";

// =============================================
// PrintJob 工廠
// =============================================

/**
 * 打印作業工廠
 *
 * 生成符合 PrintJob 介面的測試數據
 */
export class PrintJobFactory extends BaseFactory<PrintJob> {
  /**
   * 生成預設打印作業（待處理收據）
   */
  build(options?: FactoryOptions<PrintJob>): PrintJob {
    const seq = options?.sequence ?? this.getNextSequence();
    const now = new Date();

    const defaultContent: PrintContent = {
      header: {
        restaurantInfo: {
          name: `Test Restaurant ${seq}`,
          address: "123 Test St",
          phone: "0912345678",
        },
        transactionInfo: {
          orderId: `ORD-${seq}`,
          cashier: "TestCashier",
          timestamp: now,
          receiptNumber: `RCP-${seq}`,
        },
      },
      items: [
        { name: "測試餐點", quantity: 1, unitPrice: 100, totalPrice: 100 },
      ],
      summary: {
        subtotal: 100,
        tax: [{ name: "VAT", rate: 5, amount: 5, taxableAmount: 100 }],
        total: 105,
        payment: [{ method: "cash", amount: 105 }],
      },
      footer: {
        thankYouMessage: "謝謝光臨",
      },
    };

    const defaultOptions: PrintOptions = {
      copies: 1,
      cutPaper: true,
      openDrawer: false,
      buzzer: false,
      feedLines: 3,
    };

    const result: PrintJob = {
      id: randomUUID(),
      type: "receipt",
      priority: "normal",
      status: "pending",
      deviceId: randomUUID(),
      content: defaultContent,
      options: defaultOptions,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
      metadata: {
        restaurantId: randomUUID(),
        orderId: `ORD-${seq}`,
        userId: randomUUID(),
        country: "TW",
      },
    };

    return { ...result, ...options?.overrides };
  }

  /**
   * 生成待處理打印作業
   */
  buildPending(options?: FactoryOptions<PrintJob>): PrintJob {
    return this.build({
      ...options,
      overrides: {
        status: "pending",
        attempts: 0,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成已完成打印作業
   */
  buildCompleted(options?: FactoryOptions<PrintJob>): PrintJob {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 5000);

    return this.build({
      ...options,
      overrides: {
        status: "completed",
        attempts: 1,
        startedAt,
        completedAt: now,
        error: undefined,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成失敗打印作業
   */
  buildFailed(options?: FactoryOptions<PrintJob>): PrintJob {
    const now = new Date();
    const defaultError: PrintError = {
      code: "PRINT_FAILED",
      message: "Printer communication error",
      timestamp: now,
      details: { reason: "connection_timeout" },
    };

    return this.build({
      ...options,
      overrides: {
        status: "failed",
        attempts: 3,
        startedAt: new Date(now.getTime() - 10000),
        error: defaultError,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成緊急打印作業
   */
  buildUrgent(options?: FactoryOptions<PrintJob>): PrintJob {
    return this.build({
      ...options,
      overrides: {
        priority: "urgent",
        ...options?.overrides,
      },
    });
  }
}

// =============================================
// PrinterDevice 工廠
// =============================================

/**
 * 打印機設備工廠
 *
 * 生成符合 PrinterDevice 介面的測試數據
 */
export class PrinterDeviceFactory extends BaseFactory<PrinterDevice> {
  /**
   * 生成預設打印機設備（在線通用打印機）
   */
  build(options?: FactoryOptions<PrinterDevice>): PrinterDevice {
    const seq = options?.sequence ?? this.getNextSequence();

    const defaultCapabilities: PrinterCapabilities = {
      maxWidth: 80,
      supportsGraphics: true,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: true,
      supportsBarcode: true,
      supportedEncodings: ["UTF-8", "BIG5"],
      paperSizes: [{ width: 80, height: 0, name: "80mm" }],
    };

    const result: PrinterDevice = {
      id: randomUUID(),
      name: `Printer ${seq}`,
      brand: "generic",
      model: "Generic-80",
      connection: "usb",
      address: `/dev/usb/lp${seq}`,
      status: "online",
      capabilities: defaultCapabilities,
      lastSeen: new Date(),
      isDefault: seq === 0,
    };

    return { ...result, ...options?.overrides };
  }

  /**
   * 生成 Epson 打印機
   */
  buildEpson(options?: FactoryOptions<PrinterDevice>): PrinterDevice {
    return this.build({
      ...options,
      overrides: {
        brand: "epson",
        model: "TM-T88VI",
        connection: "usb",
        name: "Epson TM-T88VI",
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成 Star 打印機
   */
  buildStar(options?: FactoryOptions<PrinterDevice>): PrinterDevice {
    return this.build({
      ...options,
      overrides: {
        brand: "star",
        model: "TSP143IV",
        connection: "network",
        name: "Star TSP143IV",
        address: `192.168.1.${randomNumber(100, 200)}`,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成 Citizen 打印機
   */
  buildCitizen(options?: FactoryOptions<PrinterDevice>): PrinterDevice {
    return this.build({
      ...options,
      overrides: {
        brand: "citizen",
        model: "CT-S310II",
        connection: "usb",
        name: "Citizen CT-S310II",
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成離線打印機
   */
  buildOffline(options?: FactoryOptions<PrinterDevice>): PrinterDevice {
    return this.build({
      ...options,
      overrides: {
        status: "offline",
        ...options?.overrides,
      },
    });
  }
}

// =============================================
// PrintRequest 工廠
// =============================================

/**
 * 打印請求工廠
 *
 * 生成符合 PrintRequest 介面的測試數據
 */
export class PrintRequestFactory extends BaseFactory<PrintRequest> {
  /**
   * 生成預設打印請求（台灣收據請求）
   */
  build(options?: FactoryOptions<PrintRequest>): PrintRequest {
    const seq = options?.sequence ?? this.getNextSequence();
    const now = new Date();

    const result: PrintRequest = {
      country: "TW",
      type: "receipt",
      priority: "normal",
      deviceId: randomUUID(),
      templateId: `TPL-${seq}`,
      restaurantId: randomUUID(),
      userId: randomUUID(),
      data: {
        order: {
          id: `ORD-${seq}`,
          tableNumber: "T1",
          items: [{ name: "測試餐點", quantity: 1, price: 100, modifiers: [] }],
          subtotal: 100,
          tax: 5,
          total: 105,
          createdAt: now,
        },
      },
      options: {
        copies: 1,
        cutPaper: true,
        openDrawer: false,
      },
    };

    return { ...result, ...options?.overrides };
  }

  /**
   * 生成收據打印請求（含付款資料）
   */
  buildReceipt(options?: FactoryOptions<PrintRequest>): PrintRequest {
    const seq = options?.sequence ?? this.getNextSequence();

    return this.build({
      ...options,
      overrides: {
        type: "receipt",
        data: {
          order: {
            id: `ORD-${seq}`,
            tableNumber: "T1",
            items: [
              { name: "測試餐點", quantity: 1, price: 100, modifiers: [] },
            ],
            subtotal: 100,
            tax: 5,
            total: 105,
            createdAt: new Date(),
          },
          customer: {
            name: "測試顧客",
            phone: "0912345678",
          },
          payment: {
            method: "cash",
            amount: 105,
            change: 0,
            transactionId: `TXN-${randomString(12).toUpperCase()}`,
          },
        },
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成廚房單打印請求（無付款資料，精簡欄位）
   */
  buildKitchenTicket(options?: FactoryOptions<PrintRequest>): PrintRequest {
    const seq = options?.sequence ?? this.getNextSequence();

    return this.build({
      ...options,
      overrides: {
        type: "order",
        priority: "high",
        templateId: undefined,
        data: {
          order: {
            id: `ORD-${seq}`,
            tableNumber: "T1",
            items: [
              { name: "測試餐點", quantity: 1, price: 100, modifiers: [] },
            ],
            subtotal: 100,
            tax: 0,
            total: 100,
            createdAt: new Date(),
          },
        },
        options: {
          copies: 1,
          cutPaper: true,
          openDrawer: false,
          buzzer: true,
        },
        ...options?.overrides,
      },
    });
  }
}

// =============================================
// PrintServiceConfig 工廠
// =============================================

/**
 * 打印服務配置工廠
 *
 * 生成符合 PrintServiceConfig 介面的測試配置
 */
export const printServiceConfigFactory = {
  build(overrides?: Partial<PrintServiceConfig>): PrintServiceConfig {
    return {
      defaultDevice: null,
      queue: {
        maxConcurrentJobs: 3,
        maxRetries: 3,
        retryDelay: 1000,
        jobTimeout: 30000,
        maxQueueSize: 100,
      },
      drivers: {
        connectionTimeout: 5000,
        commandTimeout: 10000,
        heartbeatInterval: 30000,
        retryAttempts: 3,
      },
      regions: {
        default: "TW",
        supported: ["TW", "MY", "VN"],
      },
      monitoring: {
        healthCheckInterval: 60000,
        statisticsInterval: 300000,
        maxErrorHistory: 100,
        alertThresholds: {
          errorRate: 0.1,
          queueDepth: 50,
          responseTime: 5000,
        },
      },
      cleanup: {
        completedJobRetention: 86400000,
        cleanupInterval: 3600000,
      },
      ...overrides,
    };
  },
};

// =============================================
// 導出單例實例
// =============================================

export const printJobFactory = new PrintJobFactory();
export const printerDeviceFactory = new PrinterDeviceFactory();
export const printRequestFactory = new PrintRequestFactory();
