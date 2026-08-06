/**
 * Export Service for Monitoring Dashboard
 * 監控儀表板導出服務 - 支持 CSV、Excel 和 PDF 格式
 */

import jsPDF from "jspdf";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type {
  ExportOptions,
  ExportResult,
  ExportFormat,
  ExportDataType,
} from "@/types/monitoring-export";
import { useDateFormatter } from "@/composables/useDateFormatter";

export class ExportService {
  /**
   * 主要導出方法 - 根據選項導出數據
   */
  async exportData(data: any[], options: ExportOptions): Promise<ExportResult> {
    try {
      const filename = options.filename || this.generateFilename(options);

      let exportedData: Blob;
      const rowCount = data.length;

      switch (options.format) {
        case "csv":
          exportedData = await this.exportToCSV(data, options);
          break;
        case "excel":
          exportedData = await this.exportToExcel(data, options);
          break;
        case "pdf":
          exportedData = await this.exportToPDF(data, options);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      // 觸發下載
      this.downloadFile(exportedData, filename);

      return {
        success: true,
        filename,
        size: exportedData.size,
        rowCount,
        exportedAt: new Date(),
      };
    } catch (error) {
      console.error("[ExportService] Export failed:", error);
      return {
        success: false,
        filename: "",
        size: 0,
        rowCount: 0,
        exportedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 導出為 CSV 格式
   */
  private async exportToCSV(
    data: any[],
    options: ExportOptions,
  ): Promise<Blob> {
    const csvOptions = options.csvOptions || {
      delimiter: ",",
      includeHeaders: true,
      dateFormat: "YYYY-MM-DD HH:mm:ss",
    };

    // 格式化數據
    const formattedData = data.map((row) => this.formatDataRow(row, "csv"));

    // 使用 papaparse 生成 CSV
    const csv = Papa.unparse(formattedData, {
      delimiter: csvOptions.delimiter,
      header: csvOptions.includeHeaders,
    });

    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  }

  /**
   * 導出為 Excel 格式
   */
  private async exportToExcel(
    data: any[],
    options: ExportOptions,
  ): Promise<Blob> {
    // 格式化數據
    const formattedData = data.map((row) => this.formatDataRow(row, "excel"));

    // 創建工作表
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // 設置列寬
    const colWidths = this.calculateColumnWidths(formattedData);
    ws["!cols"] = colWidths;

    // 創建工作簿
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, this.getSheetName(options.dataType));

    // 如果包含多個數據類型，添加額外的工作表
    if (options.dataType === "all" && options.includeSummary) {
      const summaryData = this.generateSummaryData(data);
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "摘要");
    }

    // 生成 Excel 文件
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /**
   * 導出為 PDF 格式
   */
  private async exportToPDF(
    data: any[],
    options: ExportOptions,
  ): Promise<Blob> {
    const pdfOptions = options.pdfOptions || {
      orientation: "portrait",
      pageSize: "a4",
      includeHeader: true,
      includeFooter: true,
      includePageNumbers: true,
    };

    // 創建 PDF 文檔
    const doc = new jsPDF({
      orientation: pdfOptions.orientation,
      unit: "mm",
      format: pdfOptions.pageSize,
    });

    let yPosition = 20;

    // 添加標題
    if (pdfOptions.includeHeader) {
      doc.setFontSize(20);
      doc.text(this.getReportTitle(options.dataType), 20, yPosition);
      yPosition += 10;

      // 讀取當前語系（在方法內呼叫，確保拿到呼叫當下的 locale）
      const { formatDateTime } = useDateFormatter();

      doc.setFontSize(10);
      doc.text(`生成時間: ${formatDateTime(new Date())}`, 20, yPosition);
      doc.text(
        `時間範圍: ${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`,
        20,
        yPosition + 5,
      );
      yPosition += 15;
    }

    // 添加摘要（如果啟用）
    if (options.includeSummary) {
      const summary = this.generatePDFSummary(data, options.dataType);
      doc.setFontSize(14);
      doc.text("摘要", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      summary.forEach((line) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 25, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // 添加詳細數據表格
    if (options.includeDetails) {
      const tableData = this.prepareTableData(data, options.dataType);
      this.addPDFTable(doc, tableData, yPosition);
    }

    // 添加圖表（如果啟用）
    if (options.includeCharts) {
      // 注意：這裡需要從頁面獲取圖表的 canvas 元素
      // 實際實現時需要傳入圖表數據或 canvas 引用
      // doc.addPage()
      // this.addChartsToP DF(doc, chartData)
    }

    // 添加頁尾和頁碼
    if (pdfOptions.includeFooter) {
      const pageCount = doc.internal.pages.length - 1; // 減去第一頁
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        if (pdfOptions.includePageNumbers) {
          doc.setFontSize(8);
          doc.text(
            `第 ${i} 頁，共 ${pageCount} 頁`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: "center" },
          );
        }

        // 添加水印（如果有）
        if (pdfOptions.watermark) {
          doc.setFontSize(40);
          doc.setTextColor(200, 200, 200);
          doc.text(
            pdfOptions.watermark,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height / 2,
            { align: "center", angle: 45 },
          );
          doc.setTextColor(0, 0, 0);
        }
      }
    }

    // 返回 PDF Blob
    return doc.output("blob");
  }

  /**
   * 格式化數據行
   */
  private formatDataRow(row: any, _format: ExportFormat): any {
    const formatted: any = {};

    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        formatted[key] = this.formatDate(value);
      } else if (typeof value === "object" && value !== null) {
        formatted[key] = JSON.stringify(value);
      } else {
        formatted[key] = value;
      }
    }

    return formatted;
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 計算 Excel 列寬
   */
  private calculateColumnWidths(data: any[]): any[] {
    if (data.length === 0) return [];

    const keys = Object.keys(data[0]);
    return keys.map((key) => {
      const maxLength = Math.max(
        key.length,
        ...data.map((row) => String(row[key] || "").length),
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
  }

  /**
   * 獲取工作表名稱
   */
  private getSheetName(dataType: ExportDataType): string {
    const sheetNames: Record<ExportDataType, string> = {
      alerts: "警報記錄",
      performance: "性能指標",
      errors: "錯誤日誌",
      health: "健康狀態",
      all: "完整數據",
    };
    return sheetNames[dataType] || "數據";
  }

  /**
   * 獲取報告標題
   */
  private getReportTitle(dataType: ExportDataType): string {
    const titles: Record<ExportDataType, string> = {
      alerts: "系統警報報告",
      performance: "性能監控報告",
      errors: "錯誤日誌報告",
      health: "系統健康報告",
      all: "系統監控完整報告",
    };
    return titles[dataType] || "監控報告";
  }

  /**
   * 生成摘要數據
   */
  private generateSummaryData(data: any[]): any[] {
    // 讀取當前語系（在方法內呼叫，確保拿到呼叫當下的 locale）
    const { formatDateTime } = useDateFormatter();

    return [
      { 項目: "總記錄數", 數值: data.length },
      { 項目: "導出時間", 數值: formatDateTime(new Date()) },
      { 項目: "數據範圍", 數值: "根據篩選條件" },
    ];
  }

  /**
   * 生成 PDF 摘要
   */
  private generatePDFSummary(data: any[], dataType: ExportDataType): string[] {
    const lines: string[] = [];

    lines.push(`• 總記錄數: ${data.length}`);

    // 根據數據類型添加特定的摘要信息
    if (dataType === "alerts" || dataType === "all") {
      const alerts = data.filter((d: any) => d.type === "alert" || d.severity);
      const critical = alerts.filter(
        (a: any) => a.severity === "critical" || a.severity === "fatal",
      );
      lines.push(`• 嚴重警報: ${critical.length}`);
    }

    if (dataType === "errors" || dataType === "all") {
      const errors = data.filter((d: any) => d.type === "error" || d.errorId);
      lines.push(`• 錯誤總數: ${errors.length}`);
    }

    return lines;
  }

  /**
   * 準備表格數據
   */
  private prepareTableData(data: any[], dataType: ExportDataType): any {
    // 限制數據量以避免 PDF 過大
    const maxRows = 100;
    const limitedData = data.slice(0, maxRows);

    // 根據數據類型選擇要顯示的列
    const columns = this.getTableColumns(dataType);

    return {
      headers: columns.map((c) => c.label),
      rows: limitedData.map((row) =>
        columns.map((c) => {
          const value = row[c.key];
          if (value instanceof Date) {
            return this.formatDate(value);
          }
          return String(value || "");
        }),
      ),
    };
  }

  /**
   * 獲取表格列定義
   */
  private getTableColumns(
    dataType: ExportDataType,
  ): Array<{ key: string; label: string }> {
    const commonColumns = [
      { key: "timestamp", label: "時間" },
      { key: "component", label: "組件" },
    ];

    const typeColumns: Record<
      ExportDataType,
      Array<{ key: string; label: string }>
    > = {
      alerts: [
        ...commonColumns,
        { key: "severity", label: "嚴重程度" },
        { key: "message", label: "訊息" },
        { key: "status", label: "狀態" },
      ],
      performance: [
        ...commonColumns,
        { key: "metric", label: "指標" },
        { key: "value", label: "數值" },
        { key: "unit", label: "單位" },
      ],
      errors: [
        ...commonColumns,
        { key: "errorId", label: "錯誤 ID" },
        { key: "message", label: "錯誤訊息" },
        { key: "count", label: "次數" },
      ],
      health: [
        { key: "component", label: "組件" },
        { key: "status", label: "狀態" },
        { key: "uptime", label: "運行時間" },
        { key: "lastCheck", label: "最後檢查" },
      ],
      all: commonColumns,
    };

    return typeColumns[dataType] || commonColumns;
  }

  /**
   * 添加 PDF 表格
   */
  private addPDFTable(doc: jsPDF, tableData: any, startY: number): void {
    const { headers, rows } = tableData;

    // 簡單的表格繪製（在實際應用中可以使用 jspdf-autotable 插件）
    doc.setFontSize(12);
    doc.text("詳細數據", 20, startY);

    let y = startY + 10;
    const cellHeight = 7;
    const cellPadding = 2;
    const startX = 20;
    const cellWidth = (doc.internal.pageSize.width - 40) / headers.length;

    // 繪製表頭
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    headers.forEach((header: string, i: number) => {
      doc.rect(startX + i * cellWidth, y, cellWidth, cellHeight);
      doc.text(
        header,
        startX + i * cellWidth + cellPadding,
        y + cellHeight - cellPadding,
      );
    });
    y += cellHeight;

    // 繪製數據行
    doc.setFont("helvetica", "normal");
    rows.forEach((row: string[]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      row.forEach((cell: string, i: number) => {
        doc.rect(startX + i * cellWidth, y, cellWidth, cellHeight);
        const truncated =
          cell.length > 30 ? cell.substring(0, 27) + "..." : cell;
        doc.text(
          truncated,
          startX + i * cellWidth + cellPadding,
          y + cellHeight - cellPadding,
        );
      });
      y += cellHeight;
    });
  }

  /**
   * 生成文件名
   */
  private generateFilename(options: ExportOptions): string {
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
    const extension = options.format === "excel" ? "xlsx" : options.format;

    return `monitoring-${options.dataType}-${date}-${time}.${extension}`;
  }

  /**
   * 觸發文件下載
   */
  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * 快速導出 - 使用默認選項
   */
  async quickExport(
    data: any[],
    format: ExportFormat,
    dataType: ExportDataType,
  ): Promise<ExportResult> {
    const options: ExportOptions = {
      format,
      dataType,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
      includeCharts: false,
      includeDetails: true,
      includeSummary: true,
    };

    return this.exportData(data, options);
  }
}

// 創建單例實例
export const exportService = new ExportService();
