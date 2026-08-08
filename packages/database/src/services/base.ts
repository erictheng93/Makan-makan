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

const ORDER_NUMBER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ORDER_NUMBER_SEGMENT_SIZE = 4;
const ORDER_NUMBER_SEGMENT_MODULUS =
  ORDER_NUMBER_ALPHABET.length ** ORDER_NUMBER_SEGMENT_SIZE;

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
  WEB_PUSH_VAPID_PUBLIC_KEY?: string;
  WEB_PUSH_VAPID_PRIVATE_KEY?: string;
  WEB_PUSH_VAPID_SUBJECT?: string;
  WEB_PUSH_DELIVERER?: (delivery: {
    subscription: {
      id: string;
      endpoint: string;
      p256dhKey: string;
      authKey: string;
    };
    payload: Record<string, unknown>;
  }) => Promise<{ ok: boolean; status: number }>;
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

  constructor(d1: D1Database, env: CloudflareEnv) {
    this.d1 = d1;
    this.env = env;

    // Initialize deployment mode configuration
    this.deploymentMode = env.DEPLOYMENT_MODE || "saas";
    this.tenantId = env.TENANT_ID;
    this.tenantName = env.TENANT_NAME;

    this.db = drizzle(d1, {
      schema,
      logger: env.NODE_ENV === "development",
    });

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
   * Execute writes in a transaction.
   *
   * D1 production does not support interactive BEGIN transactions. Falling
   * back to unwrapped writes would make multi-statement mutations silently
   * non-atomic, so callers must use D1 `db.batch()` for D1-compatible atomic
   * writes instead of relying on this helper.
   */
  protected async safeTransaction<T>(
    writeFn: (db: any) => Promise<T>,
  ): Promise<T> {
    void writeFn;
    throw new Error(
      "D1 interactive transactions are unsupported; convert this write path to db.batch() for atomicity.",
    );
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
    void restaurantId;

    const timePart = this.toOrderNumberSegment(Date.now());
    const randomPart = this.toOrderNumberSegment(
      Math.floor(Math.random() * ORDER_NUMBER_SEGMENT_MODULUS),
    );
    return `${timePart}-${randomPart}`;
  }

  private toOrderNumberSegment(value: number): string {
    let remaining = Math.trunc(Math.abs(value)) % ORDER_NUMBER_SEGMENT_MODULUS;
    let segment = "";

    for (let index = 0; index < ORDER_NUMBER_SEGMENT_SIZE; index += 1) {
      segment =
        ORDER_NUMBER_ALPHABET[remaining % ORDER_NUMBER_ALPHABET.length] +
        segment;
      remaining = Math.floor(remaining / ORDER_NUMBER_ALPHABET.length);
    }

    return segment;
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
