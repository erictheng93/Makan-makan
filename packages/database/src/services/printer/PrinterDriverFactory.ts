/**
 * 打印機驅動工廠
 * 負責創建和管理不同品牌的打印機驅動程式
 */

import { EpsonDriver, type EpsonDriverConfig } from "./EpsonDriver";
import { StarDriver, type StarDriverConfig } from "./StarDriver";
import { CitizenDriver, type CitizenDriverConfig } from "./CitizenDriver";
import type {
  PrinterDevice,
  PrinterBrand,
  PrinterCapabilities,
  PrinterConnection,
} from "@makanmakan/shared-types";

export interface PrinterDriverFactory {
  createDriver(device: PrinterDevice, config?: any): Promise<any>;
  detectPrinter(connectionInfo: any): Promise<PrinterDevice | null>;
  getSupportedBrands(): PrinterBrand[];
  getDefaultCapabilities(brand: PrinterBrand): PrinterCapabilities;
}

export class DefaultPrinterDriverFactory implements PrinterDriverFactory {
  private brandDetectors: Map<PrinterBrand, (deviceInfo: string) => boolean> =
    new Map();

  constructor() {
    this.initializeBrandDetectors();
  }

  // =============================================
  // 驅動創建
  // =============================================

  async createDriver(device: PrinterDevice, config?: any): Promise<any> {
    switch (device.brand) {
      case "epson":
        return this.createEpsonDriver(device, config);

      case "star":
        return this.createStarDriver(device, config);

      case "citizen":
        return this.createCitizenDriver(device, config);

      case "generic":
        return this.createGenericDriver(device, config);

      default:
        throw new Error(`Unsupported printer brand: ${device.brand}`);
    }
  }

  private async createEpsonDriver(
    device: PrinterDevice,
    config?: EpsonDriverConfig,
  ): Promise<EpsonDriver> {
    const defaultConfig: EpsonDriverConfig = {
      connection: {
        type: device.connection,
        path: device.address,
        host: this.extractHost(device.address),
        port: this.extractPort(device.address),
        baudRate: 9600,
      },
      printer: {
        model: device.model,
        paperWidth: this.determinePaperWidth(device.model),
        encoding: "utf8",
        cutter: device.capabilities.supportsCutter,
        drawer: device.capabilities.supportsDrawer,
        buzzer: true,
      },
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new EpsonDriver(device, finalConfig);
  }

  private async createStarDriver(
    device: PrinterDevice,
    config?: StarDriverConfig,
  ): Promise<StarDriver> {
    const defaultConfig: StarDriverConfig = {
      connection: {
        type: device.connection,
        path: device.address,
        host: this.extractHost(device.address),
        port: this.extractPort(device.address),
        baudRate: 9600,
      },
      printer: {
        model: device.model,
        emulation: this.determineStarEmulation(device.model),
        paperWidth: this.determinePaperWidth(device.model),
        encoding: "utf8",
        cutter: device.capabilities.supportsCutter,
        drawer: device.capabilities.supportsDrawer,
        buzzer: true,
      },
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new StarDriver(device, finalConfig);
  }

  private async createCitizenDriver(
    device: PrinterDevice,
    config?: CitizenDriverConfig,
  ): Promise<CitizenDriver> {
    const defaultConfig: CitizenDriverConfig = {
      connection: {
        type: device.connection,
        path: device.address,
        host: this.extractHost(device.address),
        port: this.extractPort(device.address),
        baudRate: 9600,
      },
      printer: {
        model: device.model,
        series: this.determineCitizenSeries(device.model),
        paperWidth: this.determinePaperWidth(device.model),
        encoding: "utf8",
        cutter: device.capabilities.supportsCutter,
        drawer: device.capabilities.supportsDrawer,
        buzzer: true,
        presenter: device.model.toLowerCase().includes("ct-d"),
      },
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new CitizenDriver(device, finalConfig);
  }

  private async createGenericDriver(
    device: PrinterDevice,
    config?: EpsonDriverConfig,
  ): Promise<EpsonDriver> {
    // 通用驅動使用 ESC/POS 標準 (基於 Epson)
    console.log(`Creating generic ESC/POS driver for ${device.id}`);
    return this.createEpsonDriver(device, config);
  }

  // =============================================
  // 打印機檢測
  // =============================================

  async detectPrinter(connectionInfo: {
    type: PrinterConnection;
    address: string;
  }): Promise<PrinterDevice | null> {
    console.log(
      `Detecting printer at ${connectionInfo.type}:${connectionInfo.address}`,
    );

    try {
      // 嘗試連接並查詢設備資訊
      const deviceInfo = await this.queryDeviceInfo(connectionInfo);

      if (!deviceInfo) {
        return null;
      }

      // 根據回應識別品牌和型號
      const brand = this.identifyBrand(deviceInfo);
      const model = this.identifyModel(deviceInfo, brand);

      const device: PrinterDevice = {
        id: this.generateDeviceId(connectionInfo, model),
        name: `${brand.toUpperCase()} ${model}`,
        brand,
        model,
        connection: connectionInfo.type,
        address: connectionInfo.address,
        status: "offline",
        capabilities: this.getDefaultCapabilities(brand),
        lastSeen: new Date(),
        isDefault: false,
      };

      return device;
    } catch (error) {
      console.error("Printer detection failed:", error);
      return null;
    }
  }

  private async queryDeviceInfo(connectionInfo: any): Promise<string | null> {
    // 實際實作中會嘗試連接並發送設備查詢命令
    // 這裡回傳模擬的設備資訊

    // 根據地址模式猜測品牌
    if (
      connectionInfo.address.includes("epson") ||
      connectionInfo.address.includes("tm-")
    ) {
      return "EPSON TM-T88VI";
    } else if (
      connectionInfo.address.includes("star") ||
      connectionInfo.address.includes("tsp")
    ) {
      return "STAR TSP143III";
    } else if (
      connectionInfo.address.includes("citizen") ||
      connectionInfo.address.includes("ct-")
    ) {
      return "CITIZEN CT-S310II";
    }

    return null;
  }

  private identifyBrand(deviceInfo: string): PrinterBrand {
    const info = deviceInfo.toLowerCase();

    if (info.includes("epson") || info.includes("tm-")) {
      return "epson";
    } else if (info.includes("star") || info.includes("tsp")) {
      return "star";
    } else if (info.includes("citizen") || info.includes("ct-")) {
      return "citizen";
    } else {
      return "generic"; // 預設為通用 ESC/POS
    }
  }

  private identifyModel(deviceInfo: string, brand: PrinterBrand): string {
    const info = deviceInfo.toLowerCase();

    // 品牌特定的型號識別
    switch (brand) {
      case "epson":
        if (info.includes("tm-t88vi")) return "TM-T88VI";
        if (info.includes("tm-t88v")) return "TM-T88V";
        if (info.includes("tm-t20")) return "TM-T20III";
        if (info.includes("tm-m30")) return "TM-M30";
        return "TM-Series";

      case "star":
        if (info.includes("tsp143")) return "TSP143III";
        if (info.includes("tsp650")) return "TSP650II";
        if (info.includes("tsp100")) return "TSP100III";
        return "TSP-Series";

      case "citizen":
        if (info.includes("ct-s310")) return "CT-S310II";
        if (info.includes("ct-s651")) return "CT-S651";
        if (info.includes("ct-d150")) return "CT-D150";
        return "CT-Series";

      default:
        return "Generic ESC/POS";
    }
  }

  private generateDeviceId(connectionInfo: any, model: string): string {
    const prefix = connectionInfo.type.toUpperCase();
    const address = connectionInfo.address.replace(/[^a-zA-Z0-9]/g, "_");
    const modelSafe = model.replace(/[^a-zA-Z0-9]/g, "_");
    return `${prefix}_${modelSafe}_${address}_${Date.now()}`;
  }

  // =============================================
  // 支援的品牌和能力
  // =============================================

  getSupportedBrands(): PrinterBrand[] {
    return ["epson", "star", "citizen", "generic"];
  }

  getDefaultCapabilities(brand: PrinterBrand): PrinterCapabilities {
    const baseCapabilities: PrinterCapabilities = {
      maxWidth: 32,
      supportsGraphics: true,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: true,
      supportsBarcode: true,
      supportedEncodings: ["utf8", "ascii", "gb18030"],
      paperSizes: [
        { width: 58, height: 0, name: "58mm" },
        { width: 80, height: 0, name: "80mm" },
      ],
    };

    // 品牌特定的能力調整
    switch (brand) {
      case "epson":
        return {
          ...baseCapabilities,
          maxWidth: 42, // Epson 通常支援較寬的列印
          supportedEncodings: ["utf8", "ascii", "gb18030", "shift-jis"],
        };

      case "star":
        return {
          ...baseCapabilities,
          paperSizes: [
            ...baseCapabilities.paperSizes,
            { width: 58, height: 0, name: "58mm" }, // Star 支援更寬紙張
          ],
        };

      case "citizen":
        return {
          ...baseCapabilities,
          paperSizes: [
            ...baseCapabilities.paperSizes,
            { width: 82.5, height: 0, name: "82.5mm" }, // CT-D 系列特殊寬度
          ],
        };

      case "generic":
        return {
          ...baseCapabilities,
          supportsQRCode: false, // 通用驅動可能不支援 QR Code
          maxWidth: 32,
        };

      default:
        return baseCapabilities;
    }
  }

  // =============================================
  // 自動掃描和發現
  // =============================================

  async scanForPrinters(
    connectionTypes: PrinterConnection[] = ["usb", "network"],
  ): Promise<PrinterDevice[]> {
    const discoveredDevices: PrinterDevice[] = [];

    for (const connectionType of connectionTypes) {
      try {
        const devices = await this.scanConnectionType(connectionType);
        discoveredDevices.push(...devices);
      } catch (error) {
        console.error(`Failed to scan ${connectionType} printers:`, error);
      }
    }

    return discoveredDevices;
  }

  private async scanConnectionType(
    connectionType: PrinterConnection,
  ): Promise<PrinterDevice[]> {
    switch (connectionType) {
      case "usb":
        return this.scanUSBPrinters();

      case "network":
        return this.scanNetworkPrinters();

      case "serial":
        return this.scanSerialPrinters();

      default:
        return [];
    }
  }

  private async scanUSBPrinters(): Promise<PrinterDevice[]> {
    // 實際實作中會使用 USB 相關函式庫掃描設備
    // 這裡返回模擬數據
    const mockUSBPrinters = [
      {
        type: "usb" as PrinterConnection,
        address: "/dev/usb/lp0",
        vendorId: "04b8", // Epson
        productId: "0202",
      },
      {
        type: "usb" as PrinterConnection,
        address: "/dev/usb/lp1",
        vendorId: "0519", // Star
        productId: "0003",
      },
    ];

    const devices: PrinterDevice[] = [];

    for (const usbInfo of mockUSBPrinters) {
      const device = await this.detectPrinter(usbInfo);
      if (device) {
        devices.push(device);
      }
    }

    return devices;
  }

  private async scanNetworkPrinters(): Promise<PrinterDevice[]> {
    // 網路掃描 (通常掃描 9100 埠)
    const networkRanges = ["192.168.1.", "192.168.0.", "10.0.0."];
    const devices: PrinterDevice[] = [];

    for (const range of networkRanges) {
      // 簡化的網路掃描 - 實際實作會並行掃描
      for (let i = 100; i <= 110; i++) {
        const ip = range + i;
        try {
          const device = await this.detectPrinter({
            type: "network",
            address: `${ip}:9100`,
          });

          if (device) {
            devices.push(device);
          }
        } catch (error) {
          // 忽略連接失敗的 IP
        }
      }
    }

    return devices;
  }

  private async scanSerialPrinters(): Promise<PrinterDevice[]> {
    // 序列埠掃描
    const serialPorts = ["/dev/ttyUSB0", "/dev/ttyUSB1", "COM1", "COM2"];
    const devices: PrinterDevice[] = [];

    for (const port of serialPorts) {
      try {
        const device = await this.detectPrinter({
          type: "serial",
          address: port,
        });

        if (device) {
          devices.push(device);
        }
      } catch (error) {
        // 忽略無效的序列埠
      }
    }

    return devices;
  }

  // =============================================
  // 工具方法
  // =============================================

  private initializeBrandDetectors(): void {
    // 品牌特定的檢測邏輯
    this.brandDetectors.set("epson", (deviceInfo: string) => {
      return (
        deviceInfo.toLowerCase().includes("epson") || deviceInfo.includes("TM-")
      );
    });

    this.brandDetectors.set("star", (deviceInfo: string) => {
      return (
        deviceInfo.toLowerCase().includes("star") || deviceInfo.includes("TSP")
      );
    });

    this.brandDetectors.set("citizen", (deviceInfo: string) => {
      return (
        deviceInfo.toLowerCase().includes("citizen") ||
        deviceInfo.includes("CT-")
      );
    });
  }

  private extractHost(address: string): string | undefined {
    if (address.includes(":")) {
      return address.split(":")[0];
    }
    return undefined;
  }

  private extractPort(address: string): number | undefined {
    if (address.includes(":")) {
      const port = parseInt(address.split(":")[1]);
      return isNaN(port) ? undefined : port;
    }
    return undefined;
  }

  private determinePaperWidth(model: string): 58 | 80 | 58 {
    const modelLower = model.toLowerCase();

    if (modelLower.includes("58") || modelLower.includes("narrow")) {
      return 58;
    } else if (modelLower.includes("58") || modelLower.includes("wide")) {
      return 58;
    } else {
      return 80; // 預設 80mm
    }
  }

  private determineStarEmulation(
    model: string,
  ): "StarPRNT" | "StarLine" | "StarGraphic" {
    const modelLower = model.toLowerCase();

    if (modelLower.includes("graphic")) {
      return "StarGraphic";
    } else if (modelLower.includes("line")) {
      return "StarLine";
    } else {
      return "StarPRNT"; // 預設
    }
  }

  private determineCitizenSeries(
    model: string,
  ): "CT-S" | "CT-D" | "CT-E" | "PPU" {
    const modelUpper = model.toUpperCase();

    if (modelUpper.includes("CT-S")) {
      return "CT-S";
    } else if (modelUpper.includes("CT-D")) {
      return "CT-D";
    } else if (modelUpper.includes("CT-E")) {
      return "CT-E";
    } else if (modelUpper.includes("PPU")) {
      return "PPU";
    } else {
      return "CT-S"; // 預設
    }
  }

  // =============================================
  // 設備管理
  // =============================================

  async validateDevice(device: PrinterDevice): Promise<boolean> {
    try {
      const driver = await this.createDriver(device);
      const connected = await driver.connect();

      if (connected) {
        await driver.disconnect();
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Device validation failed for ${device.id}:`, error);
      return false;
    }
  }

  async getDeviceCapabilities(
    device: PrinterDevice,
  ): Promise<PrinterCapabilities> {
    try {
      const driver = await this.createDriver(device);

      // 如果有連接，可以查詢實際能力
      if (await driver.connect()) {
        // 查詢實際功能支援
        const actualCapabilities = await this.queryActualCapabilities(driver);
        await driver.disconnect();
        return actualCapabilities;
      }

      // 否則返回預設能力
      return this.getDefaultCapabilities(device.brand);
    } catch (error) {
      console.error(`Failed to get capabilities for ${device.id}:`, error);
      return this.getDefaultCapabilities(device.brand);
    }
  }

  private async queryActualCapabilities(
    driver: any,
  ): Promise<PrinterCapabilities> {
    // 實際查詢打印機能力的實作
    // 這裡返回基本能力
    return this.getDefaultCapabilities(driver.getDevice().brand);
  }
}
