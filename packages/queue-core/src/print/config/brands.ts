/**
 * 打印機品牌配置
 */

import type {
  PrinterBrand,
  PrinterCapabilities,
} from "@makanmakan/shared-types";

export interface BrandConfig {
  name: string;
  defaultModel: string;
  models: string[];
  defaultCapabilities: Partial<PrinterCapabilities>;
  connectionTypes: Array<"usb" | "network" | "serial" | "bluetooth">;
  features: {
    escpos: boolean;
    graphics: boolean;
    qrcode: boolean;
    barcode: boolean;
    cutter: boolean;
    drawer: boolean;
    buzzer: boolean;
  };
}

export const PRINTER_BRANDS: Record<PrinterBrand, BrandConfig> = {
  epson: {
    name: "Epson",
    defaultModel: "TM-T88VI",
    models: [
      "TM-T88VI",
      "TM-T88V",
      "TM-T20III",
      "TM-T82III",
      "TM-M30",
      "TM-P20",
      "TM-P60II",
      "TM-U220",
    ],
    defaultCapabilities: {
      maxWidth: 42,
      supportsGraphics: true,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: true,
      supportsBarcode: true,
      supportedEncodings: ["utf8", "ascii", "gb18030", "shift-jis"],
      paperSizes: [
        { width: 58, height: 0, name: "58mm" },
        { width: 80, height: 0, name: "80mm" },
      ],
    },
    connectionTypes: ["usb", "network", "serial"],
    features: {
      escpos: true,
      graphics: true,
      qrcode: true,
      barcode: true,
      cutter: true,
      drawer: true,
      buzzer: true,
    },
  },

  star: {
    name: "Star Micronics",
    defaultModel: "TSP143III",
    models: [
      "TSP143III",
      "TSP143IIIBI",
      "TSP143IIILAN",
      "TSP650II",
      "TSP700II",
      "TSP800II",
      "FVP10",
      "SP700",
    ],
    defaultCapabilities: {
      maxWidth: 48,
      supportsGraphics: true,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: true,
      supportsBarcode: true,
      supportedEncodings: ["utf8", "ascii", "gb18030"],
      paperSizes: [
        { width: 58, height: 0, name: "58mm" },
        { width: 80, height: 0, name: "80mm" },
        { width: 112, height: 0, name: "112mm" },
      ],
    },
    connectionTypes: ["usb", "network", "bluetooth"],
    features: {
      escpos: false, // Star 使用自己的命令集
      graphics: true,
      qrcode: true,
      barcode: true,
      cutter: true,
      drawer: true,
      buzzer: true,
    },
  },

  citizen: {
    name: "Citizen",
    defaultModel: "CT-S310II",
    models: [
      "CT-S310II",
      "CT-S651",
      "CT-S801",
      "CT-S2000",
      "CT-S4000",
      "CT-D150",
      "CT-D151",
      "PPU-700",
    ],
    defaultCapabilities: {
      maxWidth: 42,
      supportsGraphics: true,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: true,
      supportsBarcode: true,
      supportedEncodings: ["utf8", "ascii", "gb18030"],
      paperSizes: [
        { width: 58, height: 0, name: "58mm" },
        { width: 80, height: 0, name: "80mm" },
        { width: 82.5, height: 0, name: "82.5mm" }, // CT-D 系列特殊寬度
      ],
    },
    connectionTypes: ["usb", "network", "serial"],
    features: {
      escpos: true,
      graphics: true,
      qrcode: true,
      barcode: true,
      cutter: true,
      drawer: true,
      buzzer: true,
    },
  },

  generic: {
    name: "Generic ESC/POS",
    defaultModel: "Generic",
    models: ["Generic", "ESC/POS Compatible"],
    defaultCapabilities: {
      maxWidth: 32,
      supportsGraphics: false,
      supportsCutter: true,
      supportsDrawer: true,
      supportsQRCode: false,
      supportsBarcode: true,
      supportedEncodings: ["utf8", "ascii"],
      paperSizes: [
        { width: 58, height: 0, name: "58mm" },
        { width: 80, height: 0, name: "80mm" },
      ],
    },
    connectionTypes: ["usb", "network", "serial"],
    features: {
      escpos: true,
      graphics: false,
      qrcode: false,
      barcode: true,
      cutter: true,
      drawer: true,
      buzzer: false,
    },
  },
};

// 品牌特定的USB供應商ID
export const USB_VENDOR_IDS: Record<string, PrinterBrand> = {
  "04b8": "epson", // Epson
  "0519": "star", // Star Micronics
  "1d90": "citizen", // Citizen
  "0483": "generic", // Generic/Unknown
};

// 網路打印機常用端口
export const NETWORK_PORTS: Record<PrinterBrand, number[]> = {
  epson: [9100, 515, 631],
  star: [9100, 9101, 9102],
  citizen: [9100, 515],
  generic: [9100, 515],
};

// 序列通信參數
export const SERIAL_PARAMS: Record<
  PrinterBrand,
  {
    baudRate: number[];
    dataBits: number;
    stopBits: number;
    parity: "none" | "even" | "odd";
  }
> = {
  epson: {
    baudRate: [9600, 19200, 38400, 115200],
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  },
  star: {
    baudRate: [9600, 19200, 38400, 115200],
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  },
  citizen: {
    baudRate: [9600, 19200, 38400, 115200],
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  },
  generic: {
    baudRate: [9600, 19200, 38400],
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  },
};

// 命令集支援
export const COMMAND_SETS: Record<
  PrinterBrand,
  {
    escpos: boolean;
    starprnt: boolean;
    native: boolean;
    graphics: string[];
  }
> = {
  epson: {
    escpos: true,
    starprnt: false,
    native: true,
    graphics: ["raster", "bit-image", "nv-graphics"],
  },
  star: {
    escpos: false,
    starprnt: true,
    native: true,
    graphics: ["raster", "graphics", "star-graphics"],
  },
  citizen: {
    escpos: true,
    starprnt: false,
    native: true,
    graphics: ["raster", "bit-image"],
  },
  generic: {
    escpos: true,
    starprnt: false,
    native: false,
    graphics: ["basic"],
  },
};
