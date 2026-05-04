/**
 * Tenant Service
 *
 * Handles tenant CRUD operations and Cloudflare account management
 */

import type {
  ManagementEnv,
  Tenant,
  TenantResource,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantStatus,
} from "../types";
import { encrypt } from "@makanmasak/utils";
import { CloudflareApiClient } from "./CloudflareApiClient";

export class TenantService {
  private env: ManagementEnv;
  private cfClient: CloudflareApiClient;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.cfClient = new CloudflareApiClient(env);
  }

  /**
   * List tenants with filtering and pagination
   */
  async listTenants(options: {
    page: number;
    limit: number;
    status?: TenantStatus;
    search?: string;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    const { page, limit, status, search } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM tenants
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (search) {
      query +=
        " AND (business_name LIKE ? OR contact_email LIKE ? OR subdomain LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
    const countResult = await this.env.MANAGEMENT_DB.prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>();

    // Get paginated results
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await this.env.MANAGEMENT_DB.prepare(query)
      .bind(...params)
      .all<{
        id: string;
        business_name: string;
        contact_email: string;
        contact_phone: string;
        cf_account_id: string;
        subdomain: string;
        custom_domain: string;
        deployed_version: string;
        license_tier: string;
        license_key: string;
        license_expires_at: string;
        status: TenantStatus;
        created_at: string;
        activated_at: string;
        updated_at: string;
      }>();

    const tenants: Tenant[] = result.results.map((row) =>
      this.mapRowToTenant(row),
    );

    return {
      tenants,
      total: countResult?.count || 0,
    };
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      "SELECT * FROM tenants WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!result) return null;

    return this.mapRowToTenant(result as Record<string, unknown>);
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      "SELECT * FROM tenants WHERE subdomain = ?",
    )
      .bind(subdomain)
      .first();

    if (!result) return null;

    return this.mapRowToTenant(result as Record<string, unknown>);
  }

  /**
   * Create new tenant
   */
  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    const id = this.generateTenantId();
    const now = new Date().toISOString();
    const licenseKey = this.generateLicenseKey(data.licenseTier, id);

    await this.env.MANAGEMENT_DB.prepare(
      `
      INSERT INTO tenants (
        id, business_name, contact_email, contact_phone,
        subdomain, custom_domain, license_tier, license_key,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        id,
        data.businessName,
        data.contactEmail,
        data.contactPhone || null,
        data.subdomain,
        data.customDomain || null,
        data.licenseTier,
        licenseKey,
        "pending",
        now,
        now,
      )
      .run();

    return (await this.getTenantById(id))!;
  }

  /**
   * Update tenant
   */
  async updateTenant(
    id: string,
    data: UpdateTenantRequest,
  ): Promise<Tenant | null> {
    const existing = await this.getTenantById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.businessName !== undefined) {
      updates.push("business_name = ?");
      params.push(data.businessName);
    }
    if (data.contactEmail !== undefined) {
      updates.push("contact_email = ?");
      params.push(data.contactEmail);
    }
    if (data.contactPhone !== undefined) {
      updates.push("contact_phone = ?");
      params.push(data.contactPhone || null);
    }
    if (data.customDomain !== undefined) {
      updates.push("custom_domain = ?");
      params.push(data.customDomain || null);
    }
    if (data.licenseTier !== undefined) {
      updates.push("license_tier = ?");
      params.push(data.licenseTier);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      params.push(data.status);

      // Set activated_at when status changes to active
      if (data.status === "active" && existing.status !== "active") {
        updates.push("activated_at = ?");
        params.push(new Date().toISOString());
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());

    params.push(id);

    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET ${updates.join(", ")} WHERE id = ?
    `,
    )
      .bind(...params)
      .run();

    return this.getTenantById(id);
  }

  /**
   * Delete tenant (soft delete - sets status to terminated)
   */
  async deleteTenant(id: string): Promise<boolean> {
    const existing = await this.getTenantById(id);
    if (!existing) return false;

    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET status = 'terminated', updated_at = ? WHERE id = ?
    `,
    )
      .bind(new Date().toISOString(), id)
      .run();

    return true;
  }

  /**
   * Get tenant resources
   */
  async getTenantResources(tenantId: string): Promise<TenantResource[]> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      `
      SELECT * FROM tenant_resources WHERE tenant_id = ? ORDER BY created_at
    `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        tenant_id: string;
        resource_type: string;
        resource_name: string;
        resource_id: string;
        status: string;
        error_message: string;
        created_at: string;
        updated_at: string;
      }>();

    return result.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      resourceType: row.resource_type as TenantResource["resourceType"],
      resourceName: row.resource_name,
      resourceId: row.resource_id,
      status: row.status as TenantResource["status"],
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Connect Cloudflare account to tenant
   */
  async connectCloudflareAccount(
    tenantId: string,
    apiToken: string,
    accountId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify the API token works
    const isValid = await this.cfClient.verifyToken(apiToken, accountId);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid API token or account ID",
      };
    }

    // Encrypt and store the token
    const encryptedToken = await this.encryptToken(apiToken);

    await this.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants
      SET cf_account_id = ?, cf_api_token_enc = ?, updated_at = ?
      WHERE id = ?
    `,
    )
      .bind(accountId, encryptedToken, new Date().toISOString(), tenantId)
      .run();

    return { success: true };
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private generateTenantId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `T-${dateStr}-${random}`;
  }

  private generateLicenseKey(
    tier: "standard" | "professional" | "enterprise",
    tenantId: string,
  ): string {
    const tierCode =
      tier === "standard" ? "STD" : tier === "professional" ? "PRO" : "ENT";
    const code = tenantId
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(-6)
      .toUpperCase();
    const check = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MKM-${tierCode}-${code}-${check}`;
  }

  private async encryptToken(token: string): Promise<string> {
    return encrypt(token, this.env.ENCRYPTION_KEY);
  }

  private mapRowToTenant(row: Record<string, unknown>): Tenant {
    return {
      id: row.id as string,
      businessName: row.business_name as string,
      contactEmail: row.contact_email as string,
      contactPhone: row.contact_phone as string | undefined,
      cfAccountId: row.cf_account_id as string | undefined,
      cfApiTokenEnc: row.cf_api_token_enc as string | undefined,
      subdomain: row.subdomain as string,
      customDomain: row.custom_domain as string | undefined,
      deployedVersion: row.deployed_version as string | undefined,
      licenseTier: row.license_tier as Tenant["licenseTier"],
      licenseKey: row.license_key as string,
      licenseExpiresAt: row.license_expires_at as string | undefined,
      status: row.status as TenantStatus,
      createdAt: row.created_at as string,
      activatedAt: row.activated_at as string | undefined,
      updatedAt: row.updated_at as string,
    };
  }
}
