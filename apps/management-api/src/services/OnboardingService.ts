/**
 * Onboarding Service
 *
 * Handles self-service onboarding application management
 */

import type {
  ManagementEnv,
  OnboardingApplication,
  OnboardingStatus,
  CreateApplicationRequest,
  LicenseTier,
  CloudflareVerificationResult,
} from "../types";
import { TenantService } from "./TenantService";
import { CloudflareApiClient } from "./CloudflareApiClient";

export class OnboardingService {
  private env: ManagementEnv;
  private tenantService: TenantService;
  private cfClient: CloudflareApiClient;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.tenantService = new TenantService(env);
    this.cfClient = new CloudflareApiClient(env);
  }

  /**
   * Check if a subdomain is available
   * Checks both tenants and pending applications
   */
  async checkSubdomainAvailability(
    subdomain: string,
  ): Promise<{ available: boolean; suggestions?: string[] }> {
    const normalizedSubdomain = subdomain.toLowerCase().trim();

    // Check tenants table
    const existingTenant =
      await this.tenantService.getTenantBySubdomain(normalizedSubdomain);
    if (existingTenant) {
      return {
        available: false,
        suggestions: this.generateSubdomainSuggestions(normalizedSubdomain),
      };
    }

    // Check pending applications
    const existingApplication = await this.env.MANAGEMENT_DB.prepare(
      `SELECT id FROM onboarding_applications
       WHERE assigned_subdomain = ? AND status NOT IN ('rejected', 'completed')`,
    )
      .bind(normalizedSubdomain)
      .first();

    if (existingApplication) {
      return {
        available: false,
        suggestions: this.generateSubdomainSuggestions(normalizedSubdomain),
      };
    }

    return { available: true };
  }

  /**
   * Create a new onboarding application
   */
  async createApplication(
    data: CreateApplicationRequest,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<OnboardingApplication> {
    const id = this.generateApplicationId();
    const now = new Date().toISOString();

    // Determine subdomain
    let assignedSubdomain = data.subdomain?.toLowerCase().trim();

    // If no subdomain provided or it's taken, generate one
    if (assignedSubdomain) {
      const availability =
        await this.checkSubdomainAvailability(assignedSubdomain);
      if (!availability.available) {
        // Use first suggestion if original is taken
        assignedSubdomain =
          availability.suggestions?.[0] ||
          this.generateSubdomain(data.businessName);
      }
    } else {
      assignedSubdomain = this.generateSubdomain(data.businessName);
    }

    // Ensure generated subdomain is also available
    let attempts = 0;
    while (attempts < 5) {
      const check = await this.checkSubdomainAvailability(assignedSubdomain);
      if (check.available) break;
      assignedSubdomain = this.generateSubdomain(data.businessName);
      attempts++;
    }

    await this.env.MANAGEMENT_DB.prepare(
      `INSERT INTO onboarding_applications (
        id, business_name, contact_name, contact_email, contact_phone,
        plan_id, requested_subdomain, assigned_subdomain, status,
        ip_address, user_agent, created_at, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        data.businessName,
        data.contactName,
        data.contactEmail,
        data.contactPhone,
        data.planId,
        data.subdomain || null,
        assignedSubdomain,
        "submitted",
        metadata?.ipAddress || null,
        metadata?.userAgent || null,
        now,
        now,
        now,
      )
      .run();

    return (await this.getApplication(id))!;
  }

  /**
   * Get an application by ID
   */
  async getApplication(id: string): Promise<OnboardingApplication | null> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      "SELECT * FROM onboarding_applications WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!result) return null;

    return this.mapRowToApplication(result as Record<string, unknown>);
  }

  /**
   * Get an application by email
   */
  async getApplicationByEmail(
    email: string,
  ): Promise<OnboardingApplication | null> {
    const result = await this.env.MANAGEMENT_DB.prepare(
      `SELECT * FROM onboarding_applications
       WHERE contact_email = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(email)
      .first();

    if (!result) return null;

    return this.mapRowToApplication(result as Record<string, unknown>);
  }

  /**
   * Verify Cloudflare credentials for an application
   */
  async verifyCloudflareCredentials(
    applicationId: string,
    accountId: string,
    apiToken: string,
  ): Promise<CloudflareVerificationResult> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      return {
        valid: false,
        permissions: {
          workers: false,
          d1: false,
          kv: false,
          r2: false,
          pages: false,
        },
        error: "Application not found",
      };
    }

    // Verify token with permission checks
    const verificationResult = await this.cfClient.verifyTokenWithPermissions(
      apiToken,
      accountId,
    );

    if (!verificationResult.valid) {
      return verificationResult;
    }

    // Check if all required permissions are present
    const { permissions } = verificationResult;
    const hasAllPermissions =
      permissions.workers && permissions.d1 && permissions.kv && permissions.r2;

    if (!hasAllPermissions) {
      const missing: string[] = [];
      if (!permissions.workers) missing.push("Workers");
      if (!permissions.d1) missing.push("D1");
      if (!permissions.kv) missing.push("KV");
      if (!permissions.r2) missing.push("R2");

      return {
        valid: false,
        permissions,
        error: `Missing permissions: ${missing.join(", ")}`,
      };
    }

    // Store verified credentials
    const encryptedToken = await this.encryptToken(apiToken);
    const now = new Date().toISOString();

    await this.env.MANAGEMENT_DB.prepare(
      `UPDATE onboarding_applications
       SET cf_account_id = ?, cf_api_token_enc = ?, cf_verified_at = ?,
           status = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(accountId, encryptedToken, now, "cf_verified", now, applicationId)
      .run();

    return {
      valid: true,
      permissions,
    };
  }

  /**
   * Complete the application and create tenant
   */
  async completeApplication(applicationId: string): Promise<{
    success: boolean;
    tenantId?: string;
    subdomain?: string;
    error?: string;
  }> {
    const application = await this.getApplication(applicationId);

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "cf_verified") {
      return {
        success: false,
        error: `Cannot complete application with status: ${application.status}`,
      };
    }

    if (!application.cfAccountId || !application.assignedSubdomain) {
      return {
        success: false,
        error: "Cloudflare credentials not verified",
      };
    }

    const now = new Date().toISOString();

    try {
      // Update status to provisioning
      await this.updateApplicationStatus(applicationId, "provisioning");

      // Create tenant using TenantService
      const tenant = await this.tenantService.createTenant({
        businessName: application.businessName,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        subdomain: application.assignedSubdomain,
        licenseTier: application.planId as LicenseTier,
      });

      // Get the encrypted token from the application
      const appRow = await this.env.MANAGEMENT_DB.prepare(
        "SELECT cf_api_token_enc FROM onboarding_applications WHERE id = ?",
      )
        .bind(applicationId)
        .first<{ cf_api_token_enc: string }>();

      if (appRow?.cf_api_token_enc) {
        // Decrypt and connect Cloudflare account
        const decryptedToken = await this.decryptToken(appRow.cf_api_token_enc);
        await this.tenantService.connectCloudflareAccount(
          tenant.id,
          decryptedToken,
          application.cfAccountId,
        );
      }

      // Mark application as completed
      await this.env.MANAGEMENT_DB.prepare(
        `UPDATE onboarding_applications
         SET status = ?, tenant_id = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
        .bind("completed", tenant.id, now, now, applicationId)
        .run();

      return {
        success: true,
        tenantId: tenant.id,
        subdomain: application.assignedSubdomain,
      };
    } catch (error) {
      console.error("[OnboardingService] Complete error:", error);

      // Rollback status
      await this.updateApplicationStatus(applicationId, "cf_verified");

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete application",
      };
    }
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(
    id: string,
    status: OnboardingStatus,
  ): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      `UPDATE onboarding_applications SET status = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(status, new Date().toISOString(), id)
      .run();
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private generateApplicationId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `APP-${dateStr}-${random}`;
  }

  private generateSubdomain(businessName: string): string {
    // Convert to lowercase, remove special chars, replace spaces with hyphens
    const base = businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Remove multiple hyphens
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .slice(0, 20); // Limit length

    // Add random suffix for uniqueness
    const suffix = Math.random().toString(36).substring(2, 5);
    return `${base}-${suffix}`;
  }

  private generateSubdomainSuggestions(base: string): string[] {
    const suggestions: string[] = [];
    const suffixes = [
      Math.random().toString(36).substring(2, 5),
      Math.random().toString(36).substring(2, 5),
      Math.random().toString(36).substring(2, 5),
    ];

    for (const suffix of suffixes) {
      suggestions.push(`${base}-${suffix}`);
    }

    return suggestions;
  }

  private async encryptToken(token: string): Promise<string> {
    // In production, use proper encryption with ENCRYPTION_KEY
    // For now, use base64 encoding as placeholder
    return btoa(token);
  }

  private async decryptToken(encrypted: string): Promise<string> {
    // In production, use proper decryption with ENCRYPTION_KEY
    return atob(encrypted);
  }

  private mapRowToApplication(
    row: Record<string, unknown>,
  ): OnboardingApplication {
    return {
      id: row.id as string,
      businessName: row.business_name as string,
      contactName: row.contact_name as string,
      contactEmail: row.contact_email as string,
      contactPhone: row.contact_phone as string,
      planId: row.plan_id as LicenseTier,
      requestedSubdomain: row.requested_subdomain as string | undefined,
      assignedSubdomain: row.assigned_subdomain as string | undefined,
      cfAccountId: row.cf_account_id as string | undefined,
      cfVerifiedAt: row.cf_verified_at as string | undefined,
      status: row.status as OnboardingStatus,
      tenantId: row.tenant_id as string | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      createdAt: row.created_at as string,
      submittedAt: row.submitted_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
      updatedAt: row.updated_at as string,
    };
  }
}
