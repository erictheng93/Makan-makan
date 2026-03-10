/**
 * 列印服務專用錯誤類型
 */

export class PrintError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: any;

  constructor(message: string, code = "PRINT_ERROR", context?: any) {
    super(message);
    this.name = "PrintError";
    this.code = code;
    this.timestamp = new Date();
    this.context = context;

    // 確保錯誤堆疊正確
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PrintError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class PrinterConnectionError extends PrintError {
  constructor(message: string, context?: any) {
    super(message, "PRINTER_CONNECTION_ERROR", context);
    this.name = "PrinterConnectionError";
  }
}

export class PrintJobError extends PrintError {
  constructor(message: string, context?: any) {
    super(message, "PRINT_JOB_ERROR", context);
    this.name = "PrintJobError";
  }
}

export class PrintFormattingError extends PrintError {
  constructor(message: string, context?: any) {
    super(message, "PRINT_FORMATTING_ERROR", context);
    this.name = "PrintFormattingError";
  }
}

export class PrinterDriverError extends PrintError {
  constructor(message: string, context?: any) {
    super(message, "PRINTER_DRIVER_ERROR", context);
    this.name = "PrinterDriverError";
  }
}

export class PrintConfigurationError extends PrintError {
  constructor(message: string, context?: any) {
    super(message, "PRINT_CONFIGURATION_ERROR", context);
    this.name = "PrintConfigurationError";
  }
}

export class PrintTimeoutError extends PrintError {
  constructor(message: string, timeout: number, context?: any) {
    super(`${message} (timeout: ${timeout}ms)`, "PRINT_TIMEOUT_ERROR", {
      timeout,
      ...context,
    });
    this.name = "PrintTimeoutError";
  }
}

export class PrintValidationError extends PrintError {
  constructor(message: string, validationErrors: any[], context?: any) {
    super(message, "PRINT_VALIDATION_ERROR", { validationErrors, ...context });
    this.name = "PrintValidationError";
  }
}

// 錯誤工廠函數
export const createPrintError = (
  type:
    | "connection"
    | "job"
    | "formatting"
    | "driver"
    | "config"
    | "timeout"
    | "validation",
  message: string,
  context?: any,
): PrintError => {
  switch (type) {
    case "connection":
      return new PrinterConnectionError(message, context);
    case "job":
      return new PrintJobError(message, context);
    case "formatting":
      return new PrintFormattingError(message, context);
    case "driver":
      return new PrinterDriverError(message, context);
    case "config":
      return new PrintConfigurationError(message, context);
    case "timeout":
      return new PrintTimeoutError(message, context?.timeout || 5000, context);
    case "validation":
      return new PrintValidationError(
        message,
        context?.validationErrors || [],
        context,
      );
    default:
      return new PrintError(message, "UNKNOWN_PRINT_ERROR", context);
  }
};

// 錯誤處理工具
export const handlePrintError = (error: any): PrintError => {
  if (error instanceof PrintError) {
    return error;
  }

  if (error instanceof Error) {
    return new PrintError(error.message, "UNKNOWN_ERROR", {
      originalError: error,
    });
  }

  return new PrintError(String(error), "UNKNOWN_ERROR", {
    originalValue: error,
  });
};

// 錯誤分類器
export const categorizePrintError = (
  error: PrintError,
): {
  category:
    | "hardware"
    | "software"
    | "network"
    | "configuration"
    | "data"
    | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  recoverable: boolean;
} => {
  const { code } = error;

  // 硬體相關錯誤
  if (
    code.includes("CONNECTION") ||
    code.includes("DRIVER") ||
    code.includes("TIMEOUT")
  ) {
    return {
      category: "hardware",
      severity: "high",
      recoverable: true,
    };
  }

  // 軟體邏輯錯誤
  if (code.includes("JOB") || code.includes("FORMATTING")) {
    return {
      category: "software",
      severity: "medium",
      recoverable: true,
    };
  }

  // 網路相關錯誤
  if (code.includes("NETWORK") || error.message.includes("network")) {
    return {
      category: "network",
      severity: "medium",
      recoverable: true,
    };
  }

  // 配置錯誤
  if (code.includes("CONFIGURATION") || code.includes("CONFIG")) {
    return {
      category: "configuration",
      severity: "high",
      recoverable: false,
    };
  }

  // 數據驗證錯誤
  if (code.includes("VALIDATION")) {
    return {
      category: "data",
      severity: "low",
      recoverable: true,
    };
  }

  // 未知錯誤
  return {
    category: "unknown",
    severity: "medium",
    recoverable: false,
  };
};
