/**
 * Tenant Context Middleware
 *
 * Handles multi-tenant context for hybrid deployment strategy:
 * - SaaS mode: Extracts tenant from authenticated user
 * - Independent mode: Uses environment variable configuration
 *
 * This middleware should run after authentication middleware
 */

import { Context, Next } from "hono";
import type { Env } from "../types/env";
import type { TenantContext, DeploymentMode } from "../types/deployment";

// Extend Hono's context to include tenant information
declare module "hono" {
  interface ContextVariableMap {
    tenant: TenantContext;
    deploymentMode: DeploymentMode;
  }
}

/**
 * Tenant context middleware
 *
 * Sets up tenant context based on deployment mode:
 * - In SaaS mode: Uses restaurantId from authenticated user
 * - In Independent mode: Uses TENANT_ID from environment
 */
export const tenantContextMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  const deploymentMode: DeploymentMode = c.env.DEPLOYMENT_MODE || "saas";

  // Set deployment mode for easy access
  c.set("deploymentMode", deploymentMode);

  if (deploymentMode === "independent") {
    // Independent mode: Use environment variable configuration
    const tenantId = c.env.TENANT_ID;

    if (!tenantId) {
      console.error(
        "[TenantContext] TENANT_ID not configured for independent deployment",
      );
      return c.json(
        {
          success: false,
          error: "Deployment configuration error",
          code: "TENANT_NOT_CONFIGURED",
        },
        500,
      );
    }

    c.set("tenant", {
      mode: "independent",
      tenantId: tenantId,
      tenantName: c.env.TENANT_NAME,
      enforceSingleTenant: true,
    });

    // Add deployment info to response headers (useful for debugging)
    c.header("X-Deployment-Mode", "independent");
    c.header("X-Tenant-Id", tenantId);
  } else {
    // SaaS mode: Extract from authenticated user (if available)
    const user = c.get("user");

    c.set("tenant", {
      mode: "saas",
      tenantId: user?.restaurantId?.toString() || null,
      enforceSingleTenant: false,
    });

    c.header("X-Deployment-Mode", "saas");
  }

  await next();
};

/**
 * Tenant access validation middleware
 *
 * Validates that the requested resource belongs to the current tenant.
 * In independent mode, this enforces single-tenant access.
 *
 * @param resourceIdParam - The route parameter name containing the tenant/restaurant ID
 */
export const validateTenantAccess = (
  resourceIdParam: string = "restaurantId",
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const tenant = c.get("tenant");
    const user = c.get("user");
    const requestedId = c.req.param(resourceIdParam);

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant context not initialized",
          code: "TENANT_CONTEXT_MISSING",
        },
        500,
      );
    }

    // In independent mode, strictly validate tenant access
    if (tenant.enforceSingleTenant) {
      // For independent deployments, all requests must be for the configured tenant
      if (requestedId && requestedId !== tenant.tenantId) {
        console.warn(
          `[TenantContext] Access denied: requested=${requestedId}, configured=${tenant.tenantId}`,
        );
        return c.json(
          {
            success: false,
            error: "Access denied to this resource",
            code: "TENANT_ACCESS_DENIED",
          },
          403,
        );
      }
    } else {
      // SaaS mode: Use existing role-based access control
      // Admin (role 0) can access all restaurants
      if (user?.role === 0) {
        await next();
        return;
      }

      // Non-admin users can only access their assigned restaurant
      if (requestedId && user?.restaurantId?.toString() !== requestedId) {
        return c.json(
          {
            success: false,
            error: "Access denied to this restaurant",
            code: "RESTAURANT_ACCESS_DENIED",
          },
          403,
        );
      }
    }

    await next();
  };
};

/**
 * Get effective tenant ID for the current request
 *
 * Helper function to get the tenant ID regardless of deployment mode.
 * In independent mode, always returns the configured TENANT_ID.
 * In SaaS mode, returns the requested ID or user's restaurant ID.
 */
export const getEffectiveTenantId = (
  c: Context<{ Bindings: Env }>,
  requestedId?: string,
): string | null => {
  const tenant = c.get("tenant");

  if (!tenant) {
    return null;
  }

  if (tenant.enforceSingleTenant) {
    // Independent mode: Always use configured tenant ID
    return tenant.tenantId;
  }

  // SaaS mode: Use requested ID or fall back to tenant context
  return requestedId || tenant.tenantId;
};

/**
 * Check if current deployment is in independent mode
 */
export const isIndependentDeployment = (
  c: Context<{ Bindings: Env }>,
): boolean => {
  return c.get("deploymentMode") === "independent";
};

/**
 * Check if current deployment is in SaaS mode
 */
export const isSaaSDeployment = (c: Context<{ Bindings: Env }>): boolean => {
  return c.get("deploymentMode") === "saas";
};

/**
 * Require independent deployment mode
 *
 * Use this middleware to protect routes that are only available
 * in independent deployment mode.
 */
export const requireIndependentMode = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  if (!isIndependentDeployment(c)) {
    return c.json(
      {
        success: false,
        error: "This feature is only available in independent deployment mode",
        code: "INDEPENDENT_MODE_REQUIRED",
      },
      403,
    );
  }

  await next();
};

/**
 * Require SaaS deployment mode
 *
 * Use this middleware to protect routes that are only available
 * in SaaS deployment mode.
 */
export const requireSaaSMode = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  if (!isSaaSDeployment(c)) {
    return c.json(
      {
        success: false,
        error: "This feature is only available in SaaS deployment mode",
        code: "SAAS_MODE_REQUIRED",
      },
      403,
    );
  }

  await next();
};
