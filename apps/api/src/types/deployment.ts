/**
 * Deployment Mode Type Definitions
 *
 * This module defines types for the hybrid deployment strategy:
 * - SaaS mode: Multi-tenant centralized deployment
 * - Independent mode: Single-tenant managed deployment
 */

/**
 * Deployment mode options
 * - saas: Centralized multi-tenant SaaS platform
 * - independent: Managed independent deployment for single restaurant
 */
export type DeploymentMode = "saas" | "independent";

/**
 * Tenant context information available in request handlers
 */
export interface TenantContext {
  /** Current deployment mode */
  mode: DeploymentMode;

  /**
   * Tenant identifier
   * - In SaaS mode: restaurant's publicId from authenticated user
   * - In Independent mode: TENANT_ID from environment variable
   */
  tenantId: string | null;

  /**
   * Tenant display name (only in independent mode)
   */
  tenantName?: string;

  /**
   * Whether to enforce single-tenant access
   * - true in independent mode: All requests must be for the configured tenant
   * - false in SaaS mode: Requests can access any authorized restaurant
   */
  enforceSingleTenant: boolean;
}

/**
 * License status returned from license validation
 */
export interface LicenseStatus {
  /** Whether the license is valid */
  valid: boolean;

  /** Deployment mode */
  mode: DeploymentMode;

  /** License tier (for independent deployments) */
  tier?: "standard" | "professional" | "enterprise";

  /** Features enabled by the license */
  features?: LicenseFeatures;

  /** License expiration date */
  expiresAt?: string;

  /** Error message if validation failed */
  error?: string;
}

/**
 * Features controlled by license tier
 */
export interface LicenseFeatures {
  /** Maximum number of restaurants (1 for standard, 3 for professional) */
  maxRestaurants: number;

  /** AI analytics enabled */
  aiAnalytics: boolean;

  /** Advanced scheduling features */
  advancedScheduling: boolean;

  /** Leave management system */
  leaveManagement: boolean;

  /** Partnership system */
  partnerships: boolean;

  /** Custom branding */
  customBranding: boolean;

  /** Priority support */
  prioritySupport: boolean;

  /** API access */
  apiAccess: boolean;
}

/**
 * Default features for each license tier
 */
export const LICENSE_TIER_FEATURES: Record<
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

/**
 * Deployment environment configuration
 */
export interface DeploymentConfig {
  /** Deployment mode */
  mode: DeploymentMode;

  /** Tenant ID (required for independent mode) */
  tenantId?: string;

  /** Tenant display name */
  tenantName?: string;

  /** License key (required for independent mode) */
  licenseKey?: string;

  /** Central management API URL */
  centralApiUrl?: string;

  /** Platform version */
  platformVersion?: string;
}

/**
 * Health check result for independent deployments
 */
export interface DeploymentHealthStatus {
  /** Overall health status */
  status: "healthy" | "degraded" | "down";

  /** Deployment mode */
  mode: DeploymentMode;

  /** Tenant information */
  tenant?: {
    id: string;
    name: string;
  };

  /** License status */
  license: LicenseStatus;

  /** Platform version */
  version: string;

  /** Component health checks */
  components: {
    database: "up" | "down";
    cache: "up" | "down";
    storage: "up" | "down";
  };

  /** Timestamp of health check */
  checkedAt: string;
}
