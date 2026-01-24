/**
 * Cloudflare API Client
 *
 * Handles communication with Cloudflare API for resource provisioning
 */

import type {
  ManagementEnv,
  CloudflareApiResponse,
  D1DatabaseInfo,
  KVNamespaceInfo,
  R2BucketInfo,
  CloudflareVerificationResult,
  CloudflarePermissions,
} from "../types";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export class CloudflareApiClient {
  // Store env for future use (e.g., logging, metrics)
  private _env: ManagementEnv;

  constructor(env: ManagementEnv) {
    this._env = env;
  }

  // Getter for env (used for logging and future features)
  protected get env(): ManagementEnv {
    return this._env;
  }

  /**
   * Verify API token is valid and has required permissions
   */
  async verifyToken(apiToken: string, accountId: string): Promise<boolean> {
    try {
      const response = await fetch(`${CF_API_BASE}/accounts/${accountId}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Verify API token with detailed permission checks
   * Checks if the token can access Workers, D1, KV, R2, and Pages
   */
  async verifyTokenWithPermissions(
    apiToken: string,
    accountId: string,
  ): Promise<CloudflareVerificationResult> {
    const permissions: CloudflarePermissions = {
      workers: false,
      d1: false,
      kv: false,
      r2: false,
      pages: false,
    };

    // First, verify basic account access
    const accountValid = await this.verifyToken(apiToken, accountId);
    if (!accountValid) {
      return {
        valid: false,
        permissions,
        error: "Invalid API token or account ID",
      };
    }

    // Check permissions in parallel for better performance
    const [workersResult, d1Result, kvResult, r2Result, pagesResult] =
      await Promise.allSettled([
        this.checkWorkersPermission(apiToken, accountId),
        this.checkD1Permission(apiToken, accountId),
        this.checkKVPermission(apiToken, accountId),
        this.checkR2Permission(apiToken, accountId),
        this.checkPagesPermission(apiToken, accountId),
      ]);

    permissions.workers =
      workersResult.status === "fulfilled" && workersResult.value;
    permissions.d1 = d1Result.status === "fulfilled" && d1Result.value;
    permissions.kv = kvResult.status === "fulfilled" && kvResult.value;
    permissions.r2 = r2Result.status === "fulfilled" && r2Result.value;
    permissions.pages = pagesResult.status === "fulfilled" && pagesResult.value;

    return {
      valid: true,
      permissions,
    };
  }

  /**
   * Check if token has Workers permission
   */
  private async checkWorkersPermission(
    apiToken: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/workers/scripts`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if token has D1 permission
   */
  private async checkD1Permission(
    apiToken: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/d1/database`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if token has KV permission
   */
  private async checkKVPermission(
    apiToken: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/storage/kv/namespaces`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if token has R2 permission
   */
  private async checkR2Permission(
    apiToken: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/r2/buckets`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if token has Pages permission
   */
  private async checkPagesPermission(
    apiToken: string,
    accountId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/pages/projects`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = (await response.json()) as CloudflareApiResponse<unknown>;
      return data.success;
    } catch {
      return false;
    }
  }

  /**
   * Create D1 database
   */
  async createD1Database(
    apiToken: string,
    accountId: string,
    name: string,
  ): Promise<{ success: boolean; database?: D1DatabaseInfo; error?: string }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/d1/database`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        },
      );

      const data =
        (await response.json()) as CloudflareApiResponse<D1DatabaseInfo>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to create D1 database",
        };
      }

      return {
        success: true,
        database: data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create KV namespace
   */
  async createKVNamespace(
    apiToken: string,
    accountId: string,
    title: string,
  ): Promise<{
    success: boolean;
    namespace?: KVNamespaceInfo;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/storage/kv/namespaces`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        },
      );

      const data =
        (await response.json()) as CloudflareApiResponse<KVNamespaceInfo>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to create KV namespace",
        };
      }

      return {
        success: true,
        namespace: data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create R2 bucket
   */
  async createR2Bucket(
    apiToken: string,
    accountId: string,
    name: string,
  ): Promise<{ success: boolean; bucket?: R2BucketInfo; error?: string }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/r2/buckets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
        },
      );

      const data =
        (await response.json()) as CloudflareApiResponse<R2BucketInfo>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to create R2 bucket",
        };
      }

      return {
        success: true,
        bucket: data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Deploy Worker script
   */
  async deployWorker(
    apiToken: string,
    accountId: string,
    scriptName: string,
    scriptContent: string,
    bindings: Record<string, unknown>[],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create form data for worker upload
      const formData = new FormData();

      // Add metadata with bindings
      const metadata = {
        main_module: "index.js",
        bindings,
      };
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      );

      // Add the script
      formData.append(
        "index.js",
        new Blob([scriptContent], { type: "application/javascript+module" }),
        "index.js",
      );

      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          body: formData,
        },
      );

      const data = (await response.json()) as CloudflareApiResponse<unknown>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to deploy worker",
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get worker deployment info
   */
  async getWorkerInfo(
    apiToken: string,
    accountId: string,
    scriptName: string,
  ): Promise<{
    success: boolean;
    info?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        info: {
          etag: response.headers.get("etag"),
          contentType: response.headers.get("content-type"),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete worker script
   */
  async deleteWorker(
    apiToken: string,
    accountId: string,
    scriptName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      const data = (await response.json()) as CloudflareApiResponse<unknown>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to delete worker",
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run D1 migration
   */
  async runD1Migration(
    apiToken: string,
    accountId: string,
    databaseId: string,
    sql: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${CF_API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        },
      );

      const data = (await response.json()) as CloudflareApiResponse<unknown>;

      if (!data.success) {
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to run migration",
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
