/**
 * License Service
 *
 * Handles license validation for independent deployments.
 * Validates licenses against the central management API and caches results.
 *
 * License Format: MKM-{TIER}-{CODE}-{CHECK}
 * Example: MKM-PRO-YSF001-A7B2
 */

import type { Env } from "../types/env";
import type { LicenseStatus, LicenseFeatures } from "../types/deployment";

// Re-export for convenience
export { LICENSE_TIER_FEATURES } from "../types/deployment";

// Cache TTL constants
const CACHE_TTL_SUCCESS = 3600; // 1 hour for valid licenses
const CACHE_TTL_FAILURE = 300; // 5 minutes for failed validations
const CACHE_TTL_OFFLINE = 86400; // 24 hours for offline grace period

/**
 * License validation request payload
 */
interface LicenseValidationRequest {
  tenantId: string;
  licenseKey: string;
  version: string;
  timestamp: number;
}

/**
 * License validation response from central API
 */
interface LicenseValidationResponse {
  valid: boolean;
  tier?: "standard" | "professional" | "enterprise";
  features?: LicenseFeatures;
  expiresAt?: string;
  error?: string;
  message?: string;
}

/**
 * License Service for managing and validating deployment licenses
 */
export class LicenseService {
  private env: Env;
  private cacheKeyPrefix = "license:";

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Validate license for the current deployment
   *
   * Returns immediately for SaaS mode.
   * For independent mode, validates against central API with caching.
   */
  async validate(): Promise<LicenseStatus> {
    // SaaS mode doesn't require license validation
    if (this.env.DEPLOYMENT_MODE !== "independent") {
      return {
        valid: true,
        mode: "saas",
      };
    }

    // Check required configuration
    if (!this.env.TENANT_ID || !this.env.LICENSE_KEY) {
      return {
        valid: false,
        mode: "independent",
        error: "License configuration missing",
      };
    }

    // Try to get cached license status
    const cached = await this.getCachedLicense();
    if (cached) {
      return cached;
    }

    // Validate against central API
    const result = await this.validateWithCentralApi();

    // Cache the result
    await this.cacheLicenseStatus(result);

    return result;
  }

  /**
   * Get cached license status from KV
   */
  private async getCachedLicense(): Promise<LicenseStatus | null> {
    if (!this.env.CACHE_KV) {
      return null;
    }

    try {
      const cacheKey = this.getCacheKey();
      const cached = await this.env.CACHE_KV.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached) as LicenseStatus;

        // Check if license is still within validity period
        if (parsed.expiresAt) {
          const expiryDate = new Date(parsed.expiresAt);
          if (expiryDate < new Date()) {
            // License expired, need to revalidate
            return null;
          }
        }

        return parsed;
      }
    } catch (error) {
      console.error("[LicenseService] Cache read error:", error);
    }

    return null;
  }

  /**
   * Cache license status in KV
   */
  private async cacheLicenseStatus(status: LicenseStatus): Promise<void> {
    if (!this.env.CACHE_KV) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey();
      const ttl = status.valid ? CACHE_TTL_SUCCESS : CACHE_TTL_FAILURE;

      await this.env.CACHE_KV.put(cacheKey, JSON.stringify(status), {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error("[LicenseService] Cache write error:", error);
    }
  }

  /**
   * Validate license against central management API
   */
  private async validateWithCentralApi(): Promise<LicenseStatus> {
    const centralApiUrl = this.env.CENTRAL_API_URL;

    // If no central API configured, use offline validation
    if (!centralApiUrl) {
      return this.offlineValidation();
    }

    try {
      const request: LicenseValidationRequest = {
        tenantId: this.env.TENANT_ID!,
        licenseKey: this.env.LICENSE_KEY!,
        version: this.env.PLATFORM_VERSION || "1.0.0",
        timestamp: Date.now(),
      };

      const response = await fetch(`${centralApiUrl}/api/v1/licenses/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": this.env.TENANT_ID!,
          "X-Platform-Version": this.env.PLATFORM_VERSION || "1.0.0",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        // API error - use offline validation with grace period
        console.warn(
          `[LicenseService] Central API returned ${response.status}, using offline validation`,
        );
        return this.offlineValidation();
      }

      const data = (await response.json()) as LicenseValidationResponse;

      return {
        valid: data.valid,
        mode: "independent",
        tier: data.tier,
        features: data.features,
        expiresAt: data.expiresAt,
        error: data.error,
      };
    } catch {
      // Network error - use offline validation with grace period
      console.warn(
        "[LicenseService] Central API unreachable, using offline validation",
      );
      return this.offlineValidation();
    }
  }

  /**
   * Offline license validation
   *
   * Used when central API is unreachable.
   * Performs basic format validation and checks for cached valid status.
   */
  private async offlineValidation(): Promise<LicenseStatus> {
    const licenseKey = this.env.LICENSE_KEY;

    if (!licenseKey) {
      return {
        valid: false,
        mode: "independent",
        error: "License key not configured",
      };
    }

    // Basic format validation: MKM-{TIER}-{CODE}-{CHECK}
    const licensePattern = /^MKM-(STD|PRO|ENT)-[A-Z0-9]{6}-[A-Z0-9]{4}$/;
    if (!licensePattern.test(licenseKey)) {
      return {
        valid: false,
        mode: "independent",
        error: "Invalid license key format",
      };
    }

    // Extract tier from license key
    const tierCode = licenseKey.split("-")[1];
    const tier = this.getTierFromCode(tierCode);

    // Check for last known valid status in cache (with longer TTL for offline)
    const offlineCacheKey = `${this.cacheKeyPrefix}offline:${this.env.TENANT_ID}`;
    if (this.env.CACHE_KV) {
      try {
        const lastKnownValid = await this.env.CACHE_KV.get(offlineCacheKey);
        if (lastKnownValid === "valid") {
          // Return valid status based on last known state
          return {
            valid: true,
            mode: "independent",
            tier,
            features: this.getFeaturesForTier(tier),
            error: "Offline mode - using cached validation",
          };
        }
      } catch {
        // Ignore cache errors
      }
    }

    // For first-time offline validation, allow with warning
    // This provides grace period for network issues
    return {
      valid: true,
      mode: "independent",
      tier,
      features: this.getFeaturesForTier(tier),
      error: "Offline mode - license not verified with central API",
    };
  }

  /**
   * Get license tier from code
   */
  private getTierFromCode(
    code: string,
  ): "standard" | "professional" | "enterprise" {
    switch (code) {
      case "STD":
        return "standard";
      case "PRO":
        return "professional";
      case "ENT":
        return "enterprise";
      default:
        return "standard";
    }
  }

  /**
   * Get features for a license tier
   */
  private getFeaturesForTier(
    tier: "standard" | "professional" | "enterprise",
  ): LicenseFeatures {
    // Import from deployment types
    const features: Record<
      "standard" | "professional" | "enterprise",
      LicenseFeatures
    > = {
      standard: {
        maxRestaurants: 1,
        aiAnalytics: false,
        advancedScheduling: true,
        leaveManagement: true,
        partnerships: false,
        customBranding: false,
        prioritySupport: false,
        apiAccess: false,
      },
      professional: {
        maxRestaurants: 3,
        aiAnalytics: true,
        advancedScheduling: true,
        leaveManagement: true,
        partnerships: true,
        customBranding: true,
        prioritySupport: true,
        apiAccess: false,
      },
      enterprise: {
        maxRestaurants: 10,
        aiAnalytics: true,
        advancedScheduling: true,
        leaveManagement: true,
        partnerships: true,
        customBranding: true,
        prioritySupport: true,
        apiAccess: true,
      },
    };

    return features[tier];
  }

  /**
   * Get cache key for current tenant
   */
  private getCacheKey(): string {
    return `${this.cacheKeyPrefix}${this.env.TENANT_ID}`;
  }

  /**
   * Mark license as valid in offline cache
   *
   * Call this after successful online validation to enable
   * offline grace period.
   */
  async markValidForOffline(): Promise<void> {
    if (!this.env.CACHE_KV || !this.env.TENANT_ID) {
      return;
    }

    try {
      const offlineCacheKey = `${this.cacheKeyPrefix}offline:${this.env.TENANT_ID}`;
      await this.env.CACHE_KV.put(offlineCacheKey, "valid", {
        expirationTtl: CACHE_TTL_OFFLINE,
      });
    } catch (error) {
      console.error(
        "[LicenseService] Failed to mark valid for offline:",
        error,
      );
    }
  }

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(feature: keyof LicenseFeatures): Promise<boolean> {
    const status = await this.validate();

    if (!status.valid || !status.features) {
      return false;
    }

    return !!status.features[feature];
  }

  /**
   * Get the maximum number of restaurants allowed
   */
  async getMaxRestaurants(): Promise<number> {
    const status = await this.validate();

    if (!status.valid || !status.features) {
      return 1; // Default to 1 for invalid licenses
    }

    return status.features.maxRestaurants;
  }

  /**
   * Invalidate cached license (force re-validation)
   */
  async invalidateCache(): Promise<void> {
    if (!this.env.CACHE_KV || !this.env.TENANT_ID) {
      return;
    }

    try {
      const cacheKey = this.getCacheKey();
      await this.env.CACHE_KV.delete(cacheKey);
    } catch (error) {
      console.error("[LicenseService] Failed to invalidate cache:", error);
    }
  }
}

/**
 * Create a new LicenseService instance
 */
export const createLicenseService = (env: Env): LicenseService => {
  return new LicenseService(env);
};
