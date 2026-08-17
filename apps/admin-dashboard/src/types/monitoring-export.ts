/**
 * Monitoring Dashboard - Export & Report Types
 * 監控儀表板 - 導出與報告類型定義
 */

export type ExportFormat = "csv" | "excel" | "pdf";

export type ExportDataType =
  | "alerts"
  | "performance"
  | "errors"
  | "health"
  | "all";

/**
 * 一列待導出的資料。監控資料來自多個來源、欄位不固定，所以只約束「是物件」，
 * 值一律 unknown —— 讀取端必須自己收窄。
 */
export type ExportRow = Record<string, unknown>;

export interface ExportOptions {
  // 基本選項
  format: ExportFormat;
  dataType: ExportDataType;
  filename?: string;

  // 時間範圍
  startDate: Date;
  endDate: Date;

  // 數據選項
  includeCharts: boolean;
  includeDetails: boolean;
  includeSummary: boolean;

  // PDF 特定選項
  pdfOptions?: {
    orientation: "portrait" | "landscape";
    pageSize: "a4" | "letter" | "legal";
    includeHeader: boolean;
    includeFooter: boolean;
    includePageNumbers: boolean;
    companyLogo?: string;
    watermark?: string;
  };

  // CSV/Excel 特定選項
  csvOptions?: {
    delimiter: "," | ";" | "\t";
    includeHeaders: boolean;
    dateFormat: string;
  };

  // 高級選項（宣告了但尚未接線，見 exportService）
  filters?: Record<string, unknown>; // 應用的篩選器
  maxRows?: number;
  compression?: boolean;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  size: number; // bytes
  rowCount: number;
  exportedAt: Date;
  error?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportFormat;
  dataType: ExportDataType;
  defaultOptions: Partial<ExportOptions>;
  preview?: string;
}

// 預設報告範本
export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "daily-summary",
    name: "每日摘要報告",
    description: "包含過去24小時的健康狀態、性能指標和警報摘要",
    format: "pdf",
    dataType: "all",
    defaultOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: false,
      pdfOptions: {
        orientation: "portrait",
        pageSize: "a4",
        includeHeader: true,
        includeFooter: true,
        includePageNumbers: true,
      },
    },
  },
  {
    id: "weekly-performance",
    name: "週度性能報告",
    description: "過去7天的詳細性能指標和趨勢分析",
    format: "pdf",
    dataType: "performance",
    defaultOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: true,
      pdfOptions: {
        orientation: "landscape",
        pageSize: "a4",
        includeHeader: true,
        includeFooter: true,
        includePageNumbers: true,
      },
    },
  },
  {
    id: "alert-history",
    name: "警報歷史記錄",
    description: "警報的完整歷史記錄，適合數據分析",
    format: "excel",
    dataType: "alerts",
    defaultOptions: {
      includeDetails: true,
      csvOptions: {
        delimiter: ",",
        includeHeaders: true,
        dateFormat: "YYYY-MM-DD HH:mm:ss",
      },
    },
  },
  {
    id: "error-analysis",
    name: "錯誤分析報告",
    description: "錯誤日誌的詳細分析和統計",
    format: "csv",
    dataType: "errors",
    defaultOptions: {
      includeDetails: true,
      csvOptions: {
        delimiter: ",",
        includeHeaders: true,
        dateFormat: "YYYY-MM-DD HH:mm:ss",
      },
    },
  },
  {
    id: "executive-summary",
    name: "管理層摘要",
    description: "高層次的系統健康狀態和關鍵指標概覽",
    format: "pdf",
    dataType: "health",
    defaultOptions: {
      includeCharts: true,
      includeSummary: true,
      includeDetails: false,
      pdfOptions: {
        orientation: "portrait",
        pageSize: "a4",
        includeHeader: true,
        includeFooter: true,
        includePageNumbers: false,
      },
    },
  },
];

// 默認導出選項
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "csv",
  dataType: "all",
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
  endDate: new Date(),
  includeCharts: false,
  includeDetails: true,
  includeSummary: true,
  pdfOptions: {
    orientation: "portrait",
    pageSize: "a4",
    includeHeader: true,
    includeFooter: true,
    includePageNumbers: true,
  },
  csvOptions: {
    delimiter: ",",
    includeHeaders: true,
    dateFormat: "YYYY-MM-DD HH:mm:ss",
  },
};

// 生成文件名
export function generateExportFilename(
  dataType: ExportDataType,
  format: ExportFormat,
  timestamp?: Date,
): string {
  const date = timestamp || new Date();
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "-");
  // Map format to correct file extension
  const extensionMap: Record<ExportFormat, string> = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };
  return `monitoring-${dataType}-${dateStr}-${timeStr}.${extensionMap[format]}`;
}

// 估算導出大小
export function estimateExportSize(
  rowCount: number,
  format: ExportFormat,
): number {
  const avgRowSizeBytes: Record<ExportFormat, number> = {
    csv: 200,
    excel: 300,
    pdf: 500,
  };
  return rowCount * avgRowSizeBytes[format];
}
