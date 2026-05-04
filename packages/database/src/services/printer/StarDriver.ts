/**
 * Star Micronics 熱敏打印機驅動程式
 * 支援 StarPRNT 命令集
 */

import { PrinterDriver } from "../PrinterService";
import type {
  PrinterDevice,
  PrintCommand,
  PrintContent,
} from "@makanmasak/shared-types";

export interface StarDriverConfig {
  connection: {
    type: "usb" | "network" | "serial" | "bluetooth";
    path?: string;
    host?: string;
    port?: number;
    baudRate?: number;
  };
  printer: {
    model: string;
    emulation: "StarPRNT" | "StarLine" | "StarGraphic";
    paperWidth: 58 | 80 | 112; // mm
    encoding: string;
    cutter: boolean;
    drawer: boolean;
    buzzer: boolean;
  };
}

// Star 打印機命令生成器
class StarPRNTCommands {
  // Star 特殊命令前綴
  static readonly ESC = 0x1b;
  static readonly FS = 0x1c;
  static readonly GS = 0x1d;
  static readonly LF = 0x0a;

  // 初始化
  static initialize(): Buffer {
    return Buffer.from([this.ESC, 0x40]);
  }

  // 文字對齊
  static setAlignment(alignment: "left" | "center" | "right"): Buffer {
    const alignValue =
      alignment === "left" ? 0 : alignment === "center" ? 1 : 2;
    return Buffer.from([this.ESC, 0x1d, 0x61, alignValue]);
  }

  // 文字大小 (Star 特有)
  static setTextSize(width: number, height: number): Buffer {
    // Star 使用不同的大小控制
    const size = ((height - 1) << 4) | (width - 1);
    return Buffer.from([this.ESC, 0x69, 0x00, size]);
  }

  // 粗體
  static setBold(enable: boolean): Buffer {
    return Buffer.from([this.ESC, enable ? 0x45 : 0x46]);
  }

  // 底線
  static setUnderline(enable: boolean): Buffer {
    return Buffer.from([this.ESC, 0x2d, enable ? 1 : 0]);
  }

  // 反白
  static setInvert(enable: boolean): Buffer {
    return Buffer.from([this.ESC, enable ? 0x34 : 0x35]);
  }

  // 文字輸出
  static text(text: string, encoding = "utf8"): Buffer {
    return Buffer.from(text, encoding as BufferEncoding);
  }

  static textLine(text: string, encoding = "utf8"): Buffer {
    return Buffer.concat([this.text(text, encoding), Buffer.from([this.LF])]);
  }

  // 換行
  static lineFeed(lines = 1): Buffer {
    return Buffer.from(Array(lines).fill(this.LF));
  }

  // Star 特有的切紙命令
  static cutPaper(mode: "full" | "partial" = "full"): Buffer {
    return mode === "full"
      ? Buffer.from([this.ESC, 0x64, 0x00]) // 全切
      : Buffer.from([this.ESC, 0x64, 0x01]); // 半切
  }

  // 收銀櫃 (Star 格式)
  static openDrawer(): Buffer {
    return Buffer.from([this.ESC, 0x07]); // Star 標準開櫃命令
  }

  // 蜂鳴器 (Star 格式)
  static buzzer(times = 1): Buffer {
    const commands: Buffer[] = [];
    for (let i = 0; i < times; i++) {
      commands.push(Buffer.from([0x07])); // BEL 字符
    }
    return Buffer.concat(commands);
  }

  // Star 特有的條碼命令
  static barcode(
    data: string,
    type: "CODE128" | "CODE39" | "EAN13" | "EAN8" = "CODE128",
  ): Buffer {
    const commands: Buffer[] = [];

    // 設定條碼類型
    const barcodeTypeMap: Record<typeof type, number> = {
      CODE128: 0x06,
      CODE39: 0x04,
      EAN13: 0x02,
      EAN8: 0x03,
    };
    const barcodeType = barcodeTypeMap[type];
    commands.push(Buffer.from([this.ESC, 0x62, barcodeType, 0x01, 0x02, 0x48]));

    // 條碼資料
    const dataBytes = Buffer.from(data, "ascii");
    commands.push(Buffer.from([dataBytes.length]));
    commands.push(dataBytes);

    return Buffer.concat(commands);
  }

  // Star 的 QR Code (如果支援)
  static qrCode(data: string, size = 3): Buffer {
    const commands: Buffer[] = [];
    const dataBytes = Buffer.from(data, "utf8");

    // Star QR Code 命令 (模型依打印機而異)
    commands.push(Buffer.from([this.ESC, 0x1d, 0x79, 0x53, 0x30, size]));
    commands.push(Buffer.from([this.ESC, 0x1d, 0x79, 0x44, 0x31, 0x00]));
    commands.push(
      Buffer.from([dataBytes.length & 0xff, (dataBytes.length >> 8) & 0xff]),
    );
    commands.push(dataBytes);
    commands.push(Buffer.from([this.ESC, 0x1d, 0x79, 0x50]));

    return Buffer.concat(commands);
  }

  // 兩欄文字
  static textColumns(left: string, right: string, totalWidth = 32): Buffer {
    const leftBytes = Buffer.from(left, "utf8");
    const rightBytes = Buffer.from(right, "utf8");
    const spacesNeeded = Math.max(
      0,
      totalWidth - leftBytes.length - rightBytes.length,
    );

    return this.textLine(left + " ".repeat(spacesNeeded) + right);
  }

  // 分隔線
  static separator(char = "-", width = 32): Buffer {
    return this.textLine(char.repeat(width));
  }

  // Star 狀態查詢
  static getStatus(): Buffer {
    return Buffer.from([this.ESC, 0x06, 0x01]);
  }
}

export class StarDriver extends PrinterDriver {
  private connection: any = null;
  private driverConfig: StarDriverConfig;
  private _isConnected = false;

  isConnected(): boolean {
    return this._isConnected;
  }

  constructor(device: PrinterDevice, config: StarDriverConfig) {
    super(device, config);
    this.driverConfig = config;
  }

  // =============================================
  // 連線管理 (類似 Epson，但使用 Star 特有的設定)
  // =============================================

  async connect(): Promise<boolean> {
    try {
      await this.establishConnection();

      // Star 打印機初始化
      await this.initializePrinter();

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
        `Failed to connect to Star printer ${this.device.id}:`,
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
        `Error disconnecting Star printer ${this.device.id}:`,
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

      case "bluetooth":
        this.connection = await this.connectBluetooth(path!);
        break;

      default:
        throw new Error(`Unsupported connection type: ${type}`);
    }
  }

  private async connectUSB(devicePath: string): Promise<any> {
    // Star USB 連線 (類似 Epson 但可能有不同的初始化)
    const mockUSBConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve(),
    };

    console.log(`Connecting to Star USB device: ${devicePath}`);
    return mockUSBConnection;
  }

  private async connectNetwork(host: string, port: number): Promise<any> {
    // Star 網路連線 (通常使用 9100 埠)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require("net");

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        console.log(`Connected to Star network printer: ${host}:${port}`);
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
    const mockSerialConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve(),
    };

    console.log(`Connecting to Star serial port: ${port} at ${baudRate} baud`);
    return mockSerialConnection;
  }

  private async connectBluetooth(address: string): Promise<any> {
    // Star 藍牙連線實作
    const mockBluetoothConnection = {
      write: (data: Buffer) => Promise.resolve(true),
      read: () => Promise.resolve(Buffer.alloc(0)),
      close: () => Promise.resolve(),
    };

    console.log(`Connecting to Star Bluetooth device: ${address}`);
    return mockBluetoothConnection;
  }

  private async closeConnection(): Promise<void> {
    if (this.connection && this.connection.close) {
      await this.connection.close();
    }
  }

  private async initializePrinter(): Promise<void> {
    // Star 打印機特有的初始化序列
    const initCommands = StarPRNTCommands.initialize();
    await this.sendRawData(initCommands);
  }

  private async testConnection(): Promise<boolean> {
    try {
      const statusCommand = StarPRNTCommands.getStatus();
      await this.sendRawData(statusCommand);
      return true;
    } catch (error) {
      console.error("Star printer connection test failed:", error);
      return false;
    }
  }

  // =============================================
  // 打印功能
  // =============================================

  async print(commands: Buffer): Promise<boolean> {
    if (!this._isConnected || !this.connection) {
      throw new Error("Star printer not connected");
    }

    try {
      await this.sendRawData(commands);
      return true;
    } catch (error) {
      console.error(`Print failed on Star printer ${this.device.id}:`, error);
      return false;
    }
  }

  async getStatus(): Promise<PrinterDevice["status"]> {
    if (!this._isConnected) {
      return "offline";
    }

    try {
      const statusCommand = StarPRNTCommands.getStatus();
      await this.sendRawData(statusCommand);

      // Star 打印機狀態解析會有所不同
      this.device.lastSeen = new Date();
      return "online";
    } catch (error) {
      console.error(
        `Status check failed for Star printer ${this.device.id}:`,
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
      const drawerCommand = StarPRNTCommands.openDrawer();
      await this.sendRawData(drawerCommand);
      return true;
    } catch (error) {
      console.error(
        `Failed to open drawer on Star printer ${this.device.id}:`,
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
      const cutCommand = StarPRNTCommands.cutPaper("full");
      await this.sendRawData(cutCommand);
      return true;
    } catch (error) {
      console.error(
        `Failed to cut paper on Star printer ${this.device.id}:`,
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
      const buzzerCommand = StarPRNTCommands.buzzer(times);
      await this.sendRawData(buzzerCommand);
      return true;
    } catch (error) {
      console.error(`Failed to buzz on Star printer ${this.device.id}:`, error);
      return false;
    }
  }

  // =============================================
  // Star 專用命令生成
  // =============================================

  generateCommands(content: PrintContent): Buffer {
    const commands: Buffer[] = [];
    const width = this.getPaperWidth();

    // Star 特有的初始化
    commands.push(StarPRNTCommands.initialize());

    // 收據頭部
    commands.push(this.generateHeader(content.header, width));

    // 分隔線
    commands.push(StarPRNTCommands.separator("=", width));

    // 訂單項目
    commands.push(this.generateItems(content.items, width));

    // 分隔線
    commands.push(StarPRNTCommands.separator("-", width));

    // 總計區域
    commands.push(this.generateSummary(content.summary, width));

    // 分隔線
    commands.push(StarPRNTCommands.separator("=", width));

    // 收據底部
    commands.push(this.generateFooter(content.footer));

    // 結束處理
    commands.push(StarPRNTCommands.lineFeed(3));

    return Buffer.concat(commands);
  }

  private generateHeader(
    header: PrintContent["header"],
    width: number,
  ): Buffer {
    const commands: Buffer[] = [];

    // 餐廳名稱 (Star 版本)
    const restaurant = header.restaurantInfo;
    commands.push(StarPRNTCommands.setAlignment("center"));
    commands.push(StarPRNTCommands.setBold(true));
    commands.push(StarPRNTCommands.setTextSize(2, 2));
    commands.push(StarPRNTCommands.textLine(restaurant.name));
    commands.push(StarPRNTCommands.setTextSize(1, 1));
    commands.push(StarPRNTCommands.setBold(false));

    // 地址和其他資訊
    commands.push(StarPRNTCommands.textLine(restaurant.address));
    commands.push(StarPRNTCommands.textLine(`Tel: ${restaurant.phone}`));

    if (restaurant.taxNumber) {
      commands.push(
        StarPRNTCommands.textLine(`Tax No: ${restaurant.taxNumber}`),
      );
    }

    commands.push(StarPRNTCommands.setAlignment("left"));
    commands.push(StarPRNTCommands.lineFeed());

    // 交易資訊
    const transaction = header.transactionInfo;
    commands.push(
      StarPRNTCommands.textColumns(
        "Receipt:",
        transaction.receiptNumber,
        width,
      ),
    );
    commands.push(
      StarPRNTCommands.textColumns("Order:", transaction.orderId, width),
    );

    if (transaction.tableNumber) {
      commands.push(
        StarPRNTCommands.textColumns("Table:", transaction.tableNumber, width),
      );
    }

    commands.push(
      StarPRNTCommands.textColumns("Cashier:", transaction.cashier, width),
    );
    commands.push(
      StarPRNTCommands.textLine(transaction.timestamp.toLocaleString()),
    );

    return Buffer.concat(commands);
  }

  private generateItems(items: PrintContent["items"], width: number): Buffer {
    const commands: Buffer[] = [];

    for (const item of items) {
      const itemLine = `${item.name} x${item.quantity}`;
      const priceStr = this.formatPrice(item.totalPrice);
      commands.push(StarPRNTCommands.textColumns(itemLine, priceStr, width));

      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modifierLine = `  + ${modifier.name}`;
          const modifierPriceStr =
            modifier.price > 0 ? this.formatPrice(modifier.price) : "";
          commands.push(
            StarPRNTCommands.textColumns(modifierLine, modifierPriceStr, width),
          );
        }
      }
    }

    return Buffer.concat(commands);
  }

  private generateSummary(
    summary: PrintContent["summary"],
    width: number,
  ): Buffer {
    const commands: Buffer[] = [];

    // 小計
    commands.push(
      StarPRNTCommands.textColumns(
        "Subtotal:",
        this.formatPrice(summary.subtotal),
        width,
      ),
    );

    // 稅項
    if (summary.tax && summary.tax.length > 0) {
      for (const tax of summary.tax) {
        commands.push(
          StarPRNTCommands.textColumns(
            `${tax.name}:`,
            this.formatPrice(tax.amount),
            width,
          ),
        );
      }
    }

    // 總計 (Star 格式)
    commands.push(StarPRNTCommands.separator("-", width));
    commands.push(StarPRNTCommands.setBold(true));
    commands.push(StarPRNTCommands.setTextSize(1, 2));
    commands.push(
      StarPRNTCommands.textColumns(
        "TOTAL:",
        this.formatPrice(summary.total),
        width,
      ),
    );
    commands.push(StarPRNTCommands.setTextSize(1, 1));
    commands.push(StarPRNTCommands.setBold(false));

    // 支付方式
    commands.push(StarPRNTCommands.lineFeed());
    for (const payment of summary.payment) {
      commands.push(
        StarPRNTCommands.textColumns(
          payment.method,
          this.formatPrice(payment.amount),
          width,
        ),
      );
    }

    if (summary.change && summary.change > 0) {
      commands.push(
        StarPRNTCommands.textColumns(
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

    commands.push(StarPRNTCommands.setAlignment("center"));
    commands.push(StarPRNTCommands.lineFeed());
    commands.push(StarPRNTCommands.textLine(footer.thankYouMessage));

    if (footer.thankYouMessageLocal) {
      commands.push(StarPRNTCommands.textLine(footer.thankYouMessageLocal));
    }

    // QR Code (如果 Star 打印機支援)
    if (footer.qrCode && this.supportsFeature("qrcode")) {
      commands.push(StarPRNTCommands.lineFeed());
      const qrSize =
        footer.qrCode.size === "small"
          ? 3
          : footer.qrCode.size === "large"
            ? 6
            : 4;
      commands.push(StarPRNTCommands.qrCode(footer.qrCode.data, qrSize));

      if (footer.qrCode.label) {
        commands.push(StarPRNTCommands.textLine(footer.qrCode.label));
      }
    }

    // 條碼
    if (footer.barcode) {
      commands.push(StarPRNTCommands.lineFeed());
      commands.push(
        StarPRNTCommands.barcode(footer.barcode.data, footer.barcode.format),
      );
    }

    commands.push(StarPRNTCommands.setAlignment("left"));
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
    // Star 支援更多紙張寬度選項
    switch (this.driverConfig.printer.paperWidth) {
      case 58:
        return 24;
      case 80:
        return 32;
      case 112:
        return 46;
      default:
        return 32;
    }
  }

  private formatPrice(amount: number): string {
    return amount.toFixed(2);
  }

  // =============================================
  // Star 專用功能
  // =============================================

  async printTestPage(): Promise<boolean> {
    try {
      const commands: Buffer[] = [];

      commands.push(StarPRNTCommands.initialize());
      commands.push(StarPRNTCommands.setAlignment("center"));
      commands.push(StarPRNTCommands.setBold(true));
      commands.push(StarPRNTCommands.setTextSize(2, 2));
      commands.push(StarPRNTCommands.textLine("STAR PRINTER TEST"));
      commands.push(StarPRNTCommands.setTextSize(1, 1));
      commands.push(StarPRNTCommands.setBold(false));
      commands.push(StarPRNTCommands.setAlignment("left"));

      commands.push(StarPRNTCommands.separator("=", this.getPaperWidth()));
      commands.push(
        StarPRNTCommands.textLine(`Model: ${this.driverConfig.printer.model}`),
      );
      commands.push(
        StarPRNTCommands.textLine(
          `Emulation: ${this.driverConfig.printer.emulation}`,
        ),
      );
      commands.push(
        StarPRNTCommands.textLine(
          `Paper Width: ${this.driverConfig.printer.paperWidth}mm`,
        ),
      );
      commands.push(StarPRNTCommands.separator("=", this.getPaperWidth()));

      commands.push(StarPRNTCommands.setAlignment("center"));
      commands.push(StarPRNTCommands.textLine("Test completed successfully"));
      commands.push(StarPRNTCommands.lineFeed(3));

      const testCommands = Buffer.concat(commands);
      return await this.print(testCommands);
    } catch (error) {
      console.error(`Star printer test failed on ${this.device.id}:`, error);
      return false;
    }
  }

  getEmulationMode(): string {
    return this.driverConfig.printer.emulation;
  }

  // Star 打印機特有的功能檢查
  supportsStarFeature(feature: string): boolean {
    const model = this.driverConfig.printer.model.toLowerCase();

    switch (feature) {
      case "bluetooth":
        return model.includes("bluetooth") || model.includes("bt");
      case "wifi":
        return model.includes("wifi") || model.includes("lan");
      case "barcode":
        return true; // 大多數 Star 打印機支援條碼
      case "graphics":
        return this.driverConfig.printer.emulation === "StarGraphic";
      default:
        return false;
    }
  }
}
