/**
 * Epson 熱敏打印機驅動程式
 * 支援 ESC/POS 標準命令集
 */

import { PrinterDriver } from "../PrinterService";
import { ESCPOSCommands } from "./ESCPOSCommands";
import type {
  PrinterDevice,
  PrintCommand,
  PrintContent,
} from "@makanmakan/shared-types";

export interface EpsonDriverConfig {
  connection: {
    type: "usb" | "network" | "serial" | "bluetooth";
    path?: string; // USB 設備路徑或序列埠
    host?: string; // 網路 IP
    port?: number; // 網路埠號
    baudRate?: number; // 序列埠速率
  };
  printer: {
    model: string;
    paperWidth: 58 | 80; // mm
    encoding: string;
    cutter: boolean;
    drawer: boolean;
    buzzer: boolean;
  };
}

export class EpsonDriver extends PrinterDriver {
  private connection: any = null;
  private driverConfig: EpsonDriverConfig;
  private _isConnected = false;

  isConnected(): boolean {
    return this._isConnected;
  }

  constructor(device: PrinterDevice, config: EpsonDriverConfig) {
    super(device, config);
    this.driverConfig = config;
  }

  // =============================================
  // 連線管理
  // =============================================

  async connect(): Promise<boolean> {
    try {
      await this.establishConnection();

      // 測試連線
      const testResult = await this.testConnection();
      if (testResult) {
        this._isConnected = true;
        this.device.status = "online";
        this.device.lastSeen = new Date();
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `Failed to connect to Epson printer ${this.device.id}:`,
        error,
      );
      this.device.status = "error";
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connection && this._isConnected) {
        await this.closeConnection();
      }
    } catch (error) {
      console.error(
        `Error disconnecting Epson printer ${this.device.id}:`,
        error,
      );
    } finally {
      this._isConnected = false;
      this.device.status = "offline";
      this.connection = null;
    }
  }

  private async establishConnection(): Promise<void> {
    const { type, path, host, port, baudRate } = this.driverConfig.connection;

    switch (type) {
      case "usb":
        this.connection = await this.connectUSB(path!);
        break;

      case "network":
        this.connection = await this.connectNetwork(host!, port!);
        break;

      case "serial":
        this.connection = await this.connectSerial(path!, baudRate!);
        break;

      default:
        throw new Error(`Unsupported connection type: ${type}`);
    }
  }

  private async connectUSB(devicePath: string): Promise<any> {
    // Node.js USB 連線實作
    // 這裡會使用 node-usb 或類似函式庫

    // 模擬實作 - 實際需要使用 USB 函式庫
    const mockUSBConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve(),
    };

    console.log(`Connecting to USB device: ${devicePath}`);
    return mockUSBConnection;
  }

  private async connectNetwork(host: string, port: number): Promise<any> {
    // TCP Socket 連線實作
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require("net");

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        console.log(`Connected to network printer: ${host}:${port}`);
        resolve({
          write: (data: Buffer) =>
            new Promise((writeResolve, writeReject) => {
              socket.write(data, (err: any) => {
                if (err) writeReject(err);
                else writeResolve(true);
              });
            }),
          read: () => Promise.resolve(Buffer.alloc(0)),
          close: () =>
            new Promise((closeResolve) => {
              socket.end(() => closeResolve(undefined));
            }),
        });
      });

      socket.on("error", reject);
      socket.setTimeout(5000, () => {
        reject(new Error("Connection timeout"));
      });
    });
  }

  private async connectSerial(port: string, baudRate: number): Promise<any> {
    // 序列埠連線實作
    // 這裡會使用 serialport 函式庫

    // 模擬實作
    const mockSerialConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve(),
    };

    console.log(`Connecting to serial port: ${port} at ${baudRate} baud`);
    return mockSerialConnection;
  }

  private async closeConnection(): Promise<void> {
    if (this.connection && this.connection.close) {
      await this.connection.close();
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      // 發送狀態查詢命令
      const statusCommand = ESCPOSCommands.getStatus();
      await this.sendRawData(statusCommand);

      // 在實際實作中，這裡會等待並解析回應
      // 現在直接返回 true 作為模擬
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  // =============================================
  // 打印功能
  // =============================================

  async print(commands: Buffer): Promise<boolean> {
    if (!this._isConnected || !this.connection) {
      throw new Error("Printer not connected");
    }

    try {
      await this.sendRawData(commands);
      return true;
    } catch (error) {
      console.error(`Print failed on Epson printer ${this.device.id}:`, error);
      return false;
    }
  }

  async getStatus(): Promise<PrinterDevice["status"]> {
    if (!this._isConnected) {
      return "offline";
    }

    try {
      // 查詢打印機狀態
      const statusCommand = ESCPOSCommands.getStatus();
      await this.sendRawData(statusCommand);

      // 實際實作中會解析狀態回應
      // 檢查紙張、蓋子、錯誤等狀態

      this.device.lastSeen = new Date();
      return "online";
    } catch (error) {
      console.error(
        `Status check failed for Epson printer ${this.device.id}:`,
        error,
      );
      return "error";
    }
  }

  async openDrawer(): Promise<boolean> {
    if (!this.supportsFeature("drawer")) {
      return false;
    }

    try {
      const drawerCommand = ESCPOSCommands.openDrawer();
      await this.sendRawData(drawerCommand);
      return true;
    } catch (error) {
      console.error(
        `Failed to open drawer on Epson printer ${this.device.id}:`,
        error,
      );
      return false;
    }
  }

  async cutPaper(): Promise<boolean> {
    if (!this.supportsFeature("cutter")) {
      return false;
    }

    try {
      const cutCommand = ESCPOSCommands.cutPaper("full");
      await this.sendRawData(cutCommand);
      return true;
    } catch (error) {
      console.error(
        `Failed to cut paper on Epson printer ${this.device.id}:`,
        error,
      );
      return false;
    }
  }

  async buzzer(times = 1): Promise<boolean> {
    if (!this.supportsFeature("buzzer")) {
      return false;
    }

    try {
      const buzzerCommand = ESCPOSCommands.buzzer(times);
      await this.sendRawData(buzzerCommand);
      return true;
    } catch (error) {
      console.error(
        `Failed to buzz on Epson printer ${this.device.id}:`,
        error,
      );
      return false;
    }
  }

  // =============================================
  // 命令生成
  // =============================================

  generateCommands(content: PrintContent): Buffer {
    const commands: Buffer[] = [];

    // 初始化
    commands.push(ESCPOSCommands.initialize());

    // 收據頭部
    commands.push(this.generateHeader(content.header));

    // 分隔線
    commands.push(ESCPOSCommands.separator("=", this.getPaperWidth()));

    // 訂單項目
    commands.push(this.generateItems(content.items));

    // 分隔線
    commands.push(ESCPOSCommands.separator("-", this.getPaperWidth()));

    // 總計區域
    commands.push(this.generateSummary(content.summary));

    // 分隔線
    commands.push(ESCPOSCommands.separator("=", this.getPaperWidth()));

    // 收據底部
    commands.push(this.generateFooter(content.footer));

    // 結束處理
    commands.push(ESCPOSCommands.lineFeed(3));

    return Buffer.concat(commands);
  }

  private generateHeader(header: PrintContent["header"]): Buffer {
    const commands: Buffer[] = [];
    const width = this.getPaperWidth();

    // Logo (如果有)
    if (header.logo?.type === "text") {
      commands.push(ESCPOSCommands.printTitle(header.logo.data, width));
    }

    // 餐廳資訊
    const restaurant = header.restaurantInfo;
    commands.push(ESCPOSCommands.setAlignment("center"));
    commands.push(ESCPOSCommands.setBold(true));
    commands.push(ESCPOSCommands.textLine(restaurant.name));

    if (restaurant.nameLocal) {
      commands.push(ESCPOSCommands.textLine(restaurant.nameLocal));
    }

    commands.push(ESCPOSCommands.setBold(false));
    commands.push(ESCPOSCommands.textLine(restaurant.address));

    if (restaurant.addressLocal) {
      commands.push(ESCPOSCommands.textLine(restaurant.addressLocal));
    }

    commands.push(ESCPOSCommands.textLine(`Tel: ${restaurant.phone}`));

    if (restaurant.taxNumber) {
      commands.push(ESCPOSCommands.textLine(`Tax No: ${restaurant.taxNumber}`));
    }

    commands.push(ESCPOSCommands.setAlignment("left"));
    commands.push(ESCPOSCommands.lineFeed());

    // 交易資訊
    const transaction = header.transactionInfo;
    commands.push(
      ESCPOSCommands.textColumns(
        "Receipt No:",
        transaction.receiptNumber,
        width,
      ),
    );
    commands.push(
      ESCPOSCommands.textColumns("Order ID:", transaction.orderId, width),
    );

    if (transaction.tableNumber) {
      commands.push(
        ESCPOSCommands.textColumns("Table:", transaction.tableNumber, width),
      );
    }

    if (transaction.customerName) {
      commands.push(
        ESCPOSCommands.textColumns(
          "Customer:",
          transaction.customerName,
          width,
        ),
      );
    }

    commands.push(
      ESCPOSCommands.textColumns("Cashier:", transaction.cashier, width),
    );

    const dateStr = transaction.timestamp.toLocaleString();
    commands.push(ESCPOSCommands.textLine(dateStr));

    return Buffer.concat(commands);
  }

  private generateItems(items: PrintContent["items"]): Buffer {
    const commands: Buffer[] = [];
    const width = this.getPaperWidth();

    for (const item of items) {
      // 主品項
      const itemLine = `${item.name} x${item.quantity}`;
      const priceStr = this.formatPrice(item.totalPrice);
      commands.push(ESCPOSCommands.textColumns(itemLine, priceStr, width));

      // 修改項目
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modifierLine = `  + ${modifier.name}`;
          const modifierPriceStr =
            modifier.price > 0 ? this.formatPrice(modifier.price) : "";
          commands.push(
            ESCPOSCommands.textColumns(modifierLine, modifierPriceStr, width),
          );
        }
      }
    }

    return Buffer.concat(commands);
  }

  private generateSummary(summary: PrintContent["summary"]): Buffer {
    const commands: Buffer[] = [];
    const width = this.getPaperWidth();

    // 小計
    commands.push(
      ESCPOSCommands.textColumns(
        "Subtotal:",
        this.formatPrice(summary.subtotal),
        width,
      ),
    );

    // 稅項
    if (summary.tax && summary.tax.length > 0) {
      for (const tax of summary.tax) {
        commands.push(
          ESCPOSCommands.textColumns(
            `${tax.name}:`,
            this.formatPrice(tax.amount),
            width,
          ),
        );
      }
    }

    // 服務費
    if (summary.serviceCharge) {
      commands.push(
        ESCPOSCommands.textColumns(
          `${summary.serviceCharge.name}:`,
          this.formatPrice(summary.serviceCharge.amount),
          width,
        ),
      );
    }

    // 小費
    if (summary.tip && summary.tip > 0) {
      commands.push(
        ESCPOSCommands.textColumns(
          "Tip:",
          this.formatPrice(summary.tip),
          width,
        ),
      );
    }

    // 折扣
    if (summary.discount && summary.discount.amount > 0) {
      commands.push(
        ESCPOSCommands.textColumns(
          `${summary.discount.name}:`,
          `-${this.formatPrice(summary.discount.amount)}`,
          width,
        ),
      );
    }

    // 總計
    commands.push(ESCPOSCommands.separator("-", width));
    commands.push(
      ESCPOSCommands.printTotal(
        "TOTAL:",
        this.formatPrice(summary.total),
        width,
      ),
    );

    // 支付資訊
    commands.push(ESCPOSCommands.lineFeed());
    for (const payment of summary.payment) {
      commands.push(
        ESCPOSCommands.textColumns(
          `${payment.method}:`,
          this.formatPrice(payment.amount),
          width,
        ),
      );

      if (payment.details) {
        commands.push(ESCPOSCommands.textLine(`  ${payment.details}`));
      }
    }

    // 找零
    if (summary.change && summary.change > 0) {
      commands.push(
        ESCPOSCommands.textColumns(
          "Change:",
          this.formatPrice(summary.change),
          width,
        ),
      );
    }

    return Buffer.concat(commands);
  }

  private generateFooter(footer: PrintContent["footer"]): Buffer {
    const commands: Buffer[] = [];

    // 感謝訊息
    commands.push(ESCPOSCommands.setAlignment("center"));
    commands.push(ESCPOSCommands.lineFeed());
    commands.push(ESCPOSCommands.textLine(footer.thankYouMessage));

    if (footer.thankYouMessageLocal) {
      commands.push(ESCPOSCommands.textLine(footer.thankYouMessageLocal));
    }

    // QR Code
    if (footer.qrCode) {
      commands.push(ESCPOSCommands.lineFeed());
      const qrSize: 3 | 4 | 6 =
        footer.qrCode.size === "small"
          ? 3
          : footer.qrCode.size === "large"
            ? 6
            : 4;
      commands.push(ESCPOSCommands.qrCode(footer.qrCode.data, qrSize));

      if (footer.qrCode.label) {
        commands.push(ESCPOSCommands.textLine(footer.qrCode.label));
      }
    }

    // 條碼
    if (footer.barcode) {
      commands.push(ESCPOSCommands.lineFeed());
      commands.push(
        ESCPOSCommands.barcode128(footer.barcode.data, 50, 2, true),
      );

      if (footer.barcode.label) {
        commands.push(ESCPOSCommands.textLine(footer.barcode.label));
      }
    }

    // 促銷訊息
    if (footer.promotionalMessage) {
      commands.push(ESCPOSCommands.lineFeed());
      commands.push(ESCPOSCommands.textLine(footer.promotionalMessage));
    }

    // 聯絡資訊
    if (footer.contactInfo) {
      commands.push(ESCPOSCommands.lineFeed());

      if (footer.contactInfo.supportPhone) {
        commands.push(
          ESCPOSCommands.textLine(
            `Support: ${footer.contactInfo.supportPhone}`,
          ),
        );
      }

      if (footer.contactInfo.website) {
        commands.push(ESCPOSCommands.textLine(footer.contactInfo.website));
      }
    }

    // 法律聲明
    if (footer.legalNotice) {
      commands.push(ESCPOSCommands.lineFeed());
      commands.push(ESCPOSCommands.textLine(footer.legalNotice));
    }

    commands.push(ESCPOSCommands.setAlignment("left"));

    return Buffer.concat(commands);
  }

  // =============================================
  // 工具方法
  // =============================================

  private async sendRawData(data: Buffer): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    await this.connection.write(data);
  }

  private getPaperWidth(): number {
    return this.driverConfig.printer.paperWidth === 58 ? 24 : 32;
  }

  private formatPrice(amount: number): string {
    // 這裡會根據地區設定格式化價格
    // 現在使用簡單格式
    return amount.toFixed(2);
  }

  // =============================================
  // 測試和診斷
  // =============================================

  async printTestPage(): Promise<boolean> {
    try {
      const testCommands = ESCPOSCommands.printTestPage();
      return await this.print(testCommands);
    } catch (error) {
      console.error(
        `Test print failed on Epson printer ${this.device.id}:`,
        error,
      );
      return false;
    }
  }

  async getDeviceInfo(): Promise<{
    model: string;
    firmware?: string;
    paperWidth: number;
    status: string;
  }> {
    return {
      model: this.driverConfig.printer.model,
      firmware: "Unknown", // 實際實作中會查詢固件版本
      paperWidth: this.driverConfig.printer.paperWidth,
      status: this.device.status,
    };
  }
}
