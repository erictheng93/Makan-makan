import { drizzle } from "drizzle-orm/d1";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import * as schema from "../schema";
import {
  QueryCache,
  buildCacheKey,
  type QueryCacheOptions,
} from "../utils/query-cache";
import {
  getConnectionManager,
  type ConnectionManager,
} from "../utils/connection-manager";
import { SoftDeleteService } from "../utils/soft-delete";
import { fromCents, toRequiredCents } from "../utils/money";

/**
 * Deployment mode type
 * - saas: Multi-tenant centralized SaaS platform
 * - independent: Single-tenant managed deployment
 */
export type DeploymentMode = "saas" | "independent";

export interface CloudflareEnv {
  JWT_SECRET: string;
  NODE_ENV?: string;
  CACHE_KV?: KVNamespace;
  // Notification providers
  RESEND_API_KEY?: string;
  NOTIFICATION_FROM_EMAIL?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  // Deployment mode configuration
  DEPLOYMENT_MODE?: DeploymentMode;
  TENANT_ID?: string;
  TENANT_NAME?: string;
  LICENSE_KEY?: string;
  CENTRAL_API_URL?: string;
  PLATFORM_VERSION?: string;
  // Test support
  MOCK_DRIZZLE_DB?: any;
  [key: string]: any;
}

// 基礎服務類別
export class BaseService {
  protected db: ReturnType<typeof drizzle<typeof schema>>;
  protected d1: D1Database;
  protected env: CloudflareEnv;
  protected queryCache: QueryCache;
  protected connectionManager: ConnectionManager;
  protected softDelete: SoftDeleteService<typeof schema>;

  // Deployment mode properties
  protected deploymentMode: DeploymentMode;
  protected tenantId?: string;
  protected tenantName?: string;

  constructor(d1: D1Database, env: CloudflareEnv, mockDb?: any) {
    this.d1 = d1;
    this.env = env;

    // Initialize deployment mode configuration
    this.deploymentMode = env.DEPLOYMENT_MODE || "saas";
    this.tenantId = env.TENANT_ID;
    this.tenantName = env.TENANT_NAME;

    // In test environment, allow injecting a mock Drizzle instance
    // Priority: mockDb parameter > env.MOCK_DRIZZLE_DB > real drizzle
    if (mockDb && env.NODE_ENV === "test") {
      console.log("[BaseService] Using mock Drizzle instance (from parameter)");
      this.db = mockDb;
    } else if (env.MOCK_DRIZZLE_DB && env.NODE_ENV === "test") {
      console.log("[BaseService] Using mock Drizzle instance (from env)");
      this.db = env.MOCK_DRIZZLE_DB;
    } else {
      this.db = drizzle(d1, {
        schema,
        logger: env.NODE_ENV === "development",
      });
    }

    this.queryCache = new QueryCache(env.CACHE_KV);
    this.connectionManager = getConnectionManager();
    this.softDelete = new SoftDeleteService(this.db, {
      retentionDays: 90,
    });
  }

  /**
   * Execute query with caching support
   * For frequently accessed, read-only queries
   */
  protected async cachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions,
  ): Promise<T> {
    return this.queryCache.getOrExecute(cacheKey, queryFn, options);
  }

  /**
   * Invalidate cache by key or tags
   */
  protected async invalidateCache(
    keyOrTags: string | string[],
    type: "key" | "tag" = "key",
  ): Promise<void> {
    await this.queryCache.invalidate(keyOrTags, type);
  }

  /**
   * Build consistent cache keys
   */
  protected buildCacheKey(
    resource: string,
    identifier: string | number,
    suffix?: string,
  ): string {
    return buildCacheKey(resource, identifier, suffix);
  }

  /**
   * Execute query with connection management
   * Provides retry logic, timeout handling, and batching
   */
  protected async managedQuery<T>(
    queryFn: () => Promise<T>,
    options?: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
      batchable?: boolean;
    },
  ): Promise<T> {
    return this.connectionManager.executeQuery(queryFn, options);
  }

  /**
   * Get connection metrics for monitoring
   */
  protected getConnectionMetrics() {
    return this.connectionManager.getMetrics();
  }

  /**
   * Execute writes in a transaction with fallback for D1 local dev.
   * D1's local miniflare may not support explicit BEGIN transactions.
   */
  protected async safeTransaction<T>(
    writeFn: (db: any) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (tx) => writeFn(tx));
    } catch (txError: any) {
      if (txError?.message?.includes("Failed query: begin")) {
        return await writeFn(this.db);
      }
      throw txError;
    }
  }

  // 通用錯誤處理
  protected handleError(error: any, operation: string): never {
    // 安全地記錄錯誤，避免循環引用問題
    if (error instanceof Error) {
      console.error(`Database error in ${operation}:`, error.message);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.error(`Database error in ${operation}:`, String(error));
    }

    // 創建一個可序列化的錯誤對象，避免循環引用問題
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage?.includes("UNIQUE constraint failed")) {
      throw new Error("Record already exists");
    }

    if (errorMessage?.includes("FOREIGN KEY constraint failed")) {
      throw new Error("Related record not found");
    }

    if (errorMessage?.includes("NOT NULL constraint failed")) {
      throw new Error("Required field missing");
    }

    // 拋出可序列化的錯誤對象
    throw new Error(errorMessage);
  }

  // 分頁輔助函數
  protected createPagination(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    return { limit, offset };
  }

  // 生成訂單號碼
  protected generateOrderNumber(restaurantId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    return `${restaurantId}-${timestamp}-${random}`.toUpperCase();
  }

  // ===== Deployment Mode Methods =====

  /**
   * Check if current deployment is in independent mode
   */
  protected isIndependentMode(): boolean {
    return this.deploymentMode === "independent";
  }

  /**
   * Check if current deployment is in SaaS mode
   */
  protected isSaaSMode(): boolean {
    return this.deploymentMode === "saas";
  }

  /**
   * Validate tenant access for the requested resource
   *
   * In independent mode, ensures that requests can only access
   * the configured tenant's resources.
   *
   * @param requestedId - The restaurant/tenant ID being accessed
   * @returns true if access is allowed, false otherwise
   */
  protected validateTenantAccess(requestedId: string): boolean {
    if (this.deploymentMode === "independent") {
      // In independent mode, strictly enforce single-tenant access
      if (!this.tenantId) {
        console.error(
          "[BaseService] TENANT_ID not configured for independent deployment",
        );
        return false;
      }
      return requestedId === this.tenantId;
    }

    // SaaS mode: allow access (authorization handled by middleware)
    return true;
  }

  /**
   * Get the effective tenant ID for the current operation
   *
   * In independent mode, always returns the configured TENANT_ID.
   * In SaaS mode, returns the provided ID or undefined.
   *
   * @param requestedId - The requested tenant/restaurant ID
   * @returns The effective tenant ID to use
   */
  protected getEffectiveTenantId(requestedId?: string): string | undefined {
    if (this.deploymentMode === "independent") {
      // Always use configured tenant ID in independent mode
      return this.tenantId;
    }

    // SaaS mode: use the requested ID
    return requestedId;
  }

  /**
   * Get deployment information for logging/debugging
   */
  protected getDeploymentInfo(): {
    mode: DeploymentMode;
    tenantId?: string;
    tenantName?: string;
  } {
    return {
      mode: this.deploymentMode,
      tenantId: this.tenantId,
      tenantName: this.tenantName,
    };
  }

  // 計算總金額
  protected calculateOrderTotal(
    subtotal: number,
    taxRate: number = 0,
    serviceChargeRate: number = 0,
    discountAmount: number = 0,
  ) {
    const subtotalCents = toRequiredCents(subtotal);
    const discountAmountCents = toRequiredCents(discountAmount);
    const taxAmountCents = Math.round(subtotalCents * taxRate);
    const serviceChargeCents = Math.round(subtotalCents * serviceChargeRate);
    const totalAmountCents =
      subtotalCents + taxAmountCents + serviceChargeCents - discountAmountCents;

    return {
      subtotal: fromCents(subtotalCents),
      taxAmount: fromCents(taxAmountCents),
      serviceCharge: fromCents(serviceChargeCents),
      discountAmount: fromCents(discountAmountCents),
      totalAmount: fromCents(totalAmountCents),
      subtotalCents,
      taxAmountCents,
      serviceChargeCents,
      discountAmountCents,
      totalAmountCents,
    };
  }
}
