/**
 * Resilient KV Wrapper
 * KV 韌性封裝 - 提供重試機制和斷路器模式
 *
 * 功能：
 * - 指數退避重試 (最多 3 次)
 * - 斷路器模式 (連續失敗後暫停存取)
 * - 優雅降級
 * - 錯誤分類處理
 */

import type {
  KVNamespace,
  KVNamespacePutOptions,
} from "@cloudflare/workers-types";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * 韌性配置
 */
export interface KVResilienceConfig {
  /** 最大重試次數 (預設: 3) */
  maxRetries: number;
  /** 重試延遲基數 (毫秒, 預設: 100) */
  retryDelayMs: number;
  /** 斷路器觸發閾值 (連續失敗次數, 預設: 5) */
  circuitBreakerThreshold: number;
  /** 斷路器重置時間 (毫秒, 預設: 30000) */
  circuitBreakerResetMs: number;
  /** 是否記錄詳細日誌 (預設: false) */
  verbose: boolean;
}

/**
 * 斷路器狀態
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * 操作結果
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  retryCount: number;
  circuitState: CircuitState;
}

/**
 * 斷路器統計
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalOperations: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: KVResilienceConfig = {
  maxRetries: 3,
  retryDelayMs: 100,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
  verbose: false,
};

// ============================================================================
// ResilientKVWrapper Class
// ============================================================================

/**
 * 具備韌性的 KV 封裝器
 */
export class ResilientKVWrapper {
  private kv: KVNamespace;
  private config: KVResilienceConfig;

  // 斷路器狀態
  private circuitState: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalOperations = 0;

  constructor(kv: KVNamespace, config?: Partial<KVResilienceConfig>) {
    this.kv = kv;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // KV 操作
  // --------------------------------------------------------------------------

  /**
   * 獲取值 (帶重試和斷路器)
   */
  async get(key: string): Promise<string | null> {
    const result = await this.executeWithResilience<string | null>(
      () => this.kv.get(key),
      `get:${key}`,
    );
    return result.data ?? null;
  }

  /**
   * 獲取 JSON 值
   */
  async getJson<T>(key: string): Promise<T | null> {
    const result = await this.executeWithResilience<T | null>(
      () => this.kv.get(key, "json") as Promise<T | null>,
      `getJson:${key}`,
    );
    return result.data ?? null;
  }

  /**
   * 設置值 (帶重試和斷路器)
   */
  async put(
    key: string,
    value: string,
    options?: KVNamespacePutOptions,
  ): Promise<void> {
    await this.executeWithResilience<void>(
      () => this.kv.put(key, value, options),
      `put:${key}`,
    );
  }

  /**
   * 刪除值 (帶重試和斷路器)
   */
  async delete(key: string): Promise<void> {
    await this.executeWithResilience<void>(
      () => this.kv.delete(key),
      `delete:${key}`,
    );
  }

  /**
   * 列出 keys (帶重試和斷路器)
   */
  async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
    const result = await this.executeWithResilience(
      () => this.kv.list(options),
      `list:${options?.prefix || "all"}`,
    );
    return result.data;
  }

  // --------------------------------------------------------------------------
  // 韌性執行
  // --------------------------------------------------------------------------

  /**
   * 帶韌性的操作執行
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<OperationResult<T>> {
    this.totalOperations++;

    // 檢查斷路器狀態
    if (this.circuitState === "open") {
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : Infinity;

      if (timeSinceLastFailure >= this.config.circuitBreakerResetMs) {
        // 嘗試半開狀態
        this.circuitState = "half-open";
        this.log(
          `Circuit breaker entering half-open state for ${operationName}`,
        );
      } else {
        // 斷路器仍開啟，快速失敗
        this.log(`Circuit breaker is open, rejecting ${operationName}`);
        return {
          success: false,
          error: new Error("Circuit breaker is open"),
          retryCount: 0,
          circuitState: this.circuitState,
        };
      }
    }

    // 重試邏輯
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const data = await operation();
        this.onSuccess();
        return {
          success: true,
          data,
          retryCount: attempt,
          circuitState: this.circuitState,
        };
      } catch (error) {
        lastError = error as Error;
        retryCount = attempt;

        // 判斷是否應該重試
        if (!this.shouldRetry(lastError) || attempt >= this.config.maxRetries) {
          break;
        }

        // 指數退避延遲
        const delay = this.config.retryDelayMs * Math.pow(2, attempt);
        this.log(
          `Retrying ${operationName} after ${delay}ms (attempt ${attempt + 1})`,
        );
        await this.sleep(delay);
      }
    }

    // 所有重試都失敗
    this.onFailure();
    return {
      success: false,
      error: lastError ?? new Error("Unknown error"),
      retryCount,
      circuitState: this.circuitState,
    };
  }

  // --------------------------------------------------------------------------
  // 斷路器邏輯
  // --------------------------------------------------------------------------

  /**
   * 操作成功時的處理
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.circuitState === "half-open") {
      // 半開狀態成功，關閉斷路器
      this.circuitState = "closed";
      this.failureCount = 0;
      this.log("Circuit breaker closed after successful operation");
    } else if (this.circuitState === "closed") {
      // 重置失敗計數
      this.failureCount = 0;
    }
  }

  /**
   * 操作失敗時的處理
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === "half-open") {
      // 半開狀態失敗，重新打開斷路器
      this.circuitState = "open";
      this.log("Circuit breaker reopened after failed half-open attempt");
    } else if (
      this.circuitState === "closed" &&
      this.failureCount >= this.config.circuitBreakerThreshold
    ) {
      // 達到閾值，打開斷路器
      this.circuitState = "open";
      this.log(
        `Circuit breaker opened after ${this.failureCount} consecutive failures`,
      );
    }
  }

  /**
   * 判斷錯誤是否應該重試
   */
  private shouldRetry(error: Error): boolean {
    const message = error.message.toLowerCase();

    // 不重試的錯誤類型
    const nonRetryableErrors = [
      "key not found",
      "value too large",
      "invalid key",
      "unauthorized",
      "forbidden",
    ];

    for (const nonRetryable of nonRetryableErrors) {
      if (message.includes(nonRetryable)) {
        return false;
      }
    }

    // 可重試的錯誤類型
    const retryableErrors = [
      "timeout",
      "network",
      "connection",
      "temporary",
      "rate limit",
      "service unavailable",
      "503",
      "502",
      "504",
    ];

    for (const retryable of retryableErrors) {
      if (message.includes(retryable)) {
        return true;
      }
    }

    // 預設為可重試
    return true;
  }

  // --------------------------------------------------------------------------
  // 狀態查詢
  // --------------------------------------------------------------------------

  /**
   * 獲取斷路器統計
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalOperations: this.totalOperations,
    };
  }

  /**
   * 檢查是否健康
   */
  isHealthy(): boolean {
    return this.circuitState === "closed";
  }

  /**
   * 手動重置斷路器
   */
  reset(): void {
    this.circuitState = "closed";
    this.failureCount = 0;
    this.log("Circuit breaker manually reset");
  }

  // --------------------------------------------------------------------------
  // 輔助方法
  // --------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[ResilientKV] ${message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 創建具備韌性的 KV 封裝器
 */
export function createResilientKV(
  kv: KVNamespace,
  config?: Partial<KVResilienceConfig>,
): ResilientKVWrapper {
  return new ResilientKVWrapper(kv, config);
}

/**
 * 使用預設配置創建 (適用於一般快取)
 */
export function createCacheKV(kv: KVNamespace): ResilientKVWrapper {
  return new ResilientKVWrapper(kv, {
    maxRetries: 2,
    retryDelayMs: 50,
    circuitBreakerThreshold: 10,
    circuitBreakerResetMs: 60000,
  });
}

/**
 * 使用安全配置創建 (適用於 Token Blacklist)
 */
export function createSecurityKV(kv: KVNamespace): ResilientKVWrapper {
  return new ResilientKVWrapper(kv, {
    maxRetries: 3,
    retryDelayMs: 100,
    circuitBreakerThreshold: 3,
    circuitBreakerResetMs: 15000,
    verbose: true,
  });
}
