/**
 * 統一列印服務模組
 * 提供完整的熱敏打印機管理、收據格式化和列印佇列功能
 */

// 核心服務
export { PrinterService } from "./services/PrinterService";
export { PrintJobManager } from "./services/PrintJobManager";
export { RegionManager } from "./services/RegionManager";

// 收據格式化
export { ReceiptFormattingService } from "./formatters/ReceiptFormattingService";
export { ReceiptFormatterFactory } from "./formatters/ReceiptFormatterFactory";
// IRegionFormatter is retained as a public type export. The concrete region
// formatter classes and RegionFormatterFactory were removed as dead code
// (no consumers); the interface stays here to keep the package's type surface.
export interface IRegionFormatter {
  formatCurrency(amount: number): string;
  formatDate(date: Date): string;
  formatTime(date: Date): string;
  formatPhone(phone: string): string;
  formatTaxNumber(taxNumber: string): string;
  formatAddress(address: string): string;
  getReceiptTitle(): string;
  getTaxLabel(): string;
  getCurrencySymbol(): string;
}

// 打印機驅動
export { PrinterDriverFactory } from "./drivers/PrinterDriverFactory";
export { PrinterDriver } from "./drivers/PrinterDriver";
export { EpsonDriver } from "./drivers/EpsonDriver";
export { StarDriver } from "./drivers/StarDriver";
export { CitizenDriver } from "./drivers/CitizenDriver";

// ESC/POS 命令
export { ESCPOSCommands } from "./commands/ESCPOSCommands";
export { CommandBuilder } from "./commands/CommandBuilder";

// 工具和助手
export { PrintContentValidator } from "./utils/PrintContentValidator";
export { PrinterHealthMonitor } from "./utils/PrinterHealthMonitor";
export { PrintStatisticsCollector } from "./utils/PrintStatisticsCollector";

// 類型定義
export type {
  PrinterDevice,
  PrintJob,
  PrintRequest,
  PrintResponse,
  PrintContent,
  PrinterEvent,
  PrintServiceConfig,
  PrintJobStatus,
  PrintStatistics,
  RegionConfig,
  CountryCode,
  ReceiptTemplate,
  PrinterCapabilities,
  PrintOptions,
} from "@makanmakan/shared-types";

// 常數和配置
export { DEFAULT_PRINT_CONFIG } from "./config/defaults";
export { PRINTER_BRANDS } from "./config/brands";
export { REGION_CONFIGS } from "./config/regions";

// 錯誤類型
export {
  PrintError,
  PrinterConnectionError,
  PrintJobError,
  PrintFormattingError,
} from "./errors/PrintErrors";
