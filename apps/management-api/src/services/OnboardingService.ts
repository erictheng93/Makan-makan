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
  OnboardingPlanId,
} from "../types";
import { TenantService } from "./TenantService";
import {
  generateLicenseKey,
  randomBase36,
  randomBase36Upper,
} from "../utils/random";
import {
  DEFAULT_BILLING_CYCLE_MS,
  planIdToTier,
  TRIAL_DURATION_MS,
} from "@makanmakan/database";
import bcrypt from "bcryptjs";

interface ProvisionedOwnerAccount {
  restaurantId: string;
  userId: string;
  username: string;
  initialPassword: string;
}

export class OnboardingService {
  private env: ManagementEnv;
  private tenantService: TenantService;

  constructor(env: ManagementEnv) {
    this.env = env;
    this.tenantService = new TenantService(env);
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
    const applicationSecret = this.generateApplicationSecret();
    const applicationSecretHash =
      await this.hashApplicationSecret(applicationSecret);

    let assignedSubdomain = this.generateSubdomain(data.businessName);

    // Ensure generated subdomain is also available
    let attempts = 0;
    while (attempts < 5) {
      const check = await this.checkSubdomainAvailability(assignedSubdomain);
      if (check.available) break;
      assignedSubdomain = this.generateSubdomain(data.businessName);
      attempts++;
    }

    const finalAvailability =
      await this.checkSubdomainAvailability(assignedSubdomain);
    if (!finalAvailability.available) {
      throw new Error("Unable to generate an available subdomain");
    }

    await this.env.MANAGEMENT_DB.prepare(
      `INSERT INTO onboarding_applications (
        id, business_name, contact_name, contact_email, contact_phone,
        plan_id, latitude, longitude, requested_subdomain, assigned_subdomain, status,
        application_secret_hash, ip_address, user_agent, created_at, submitted_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        data.businessName,
        data.contactName,
        data.contactEmail,
        data.contactPhone,
        data.planId ?? "trial",
        data.latitude,
        data.longitude,
        null,
        assignedSubdomain,
        "submitted",
        applicationSecretHash,
        metadata?.ipAddress || null,
        metadata?.userAgent || null,
        now,
        now,
        now,
      )
      .run();

    return {
      ...(await this.getApplication(id))!,
      applicationSecret,
    };
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

  async listApplications(input: {
    status?: OnboardingStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    applications: OnboardingApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(input.page ?? 1, 1);
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const offset = (page - 1) * limit;
    const whereClause = input.status ? "WHERE status = ?" : "";
    const bindings = input.status ? [input.status] : [];

    const countResult = await this.env.MANAGEMENT_DB.prepare(
      `SELECT COUNT(*) AS count FROM onboarding_applications ${whereClause}`,
    )
      .bind(...bindings)
      .first<{ count: number }>();

    const result = await this.env.MANAGEMENT_DB.prepare(
      `SELECT * FROM onboarding_applications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, limit, offset)
      .all<Record<string, unknown>>();

    return {
      applications: (result.results ?? []).map((row) =>
        this.mapRowToApplication(row),
      ),
      total: Number(countResult?.count ?? 0),
      page,
      limit,
    };
  }

  /**
   * Verify the one-time secret returned when an application is created.
   */
  async verifyApplicationSecret(
    applicationId: string,
    applicationSecret: string,
  ): Promise<boolean> {
    if (!applicationId || !applicationSecret) return false;

    const result = await this.env.MANAGEMENT_DB.prepare(
      "SELECT application_secret_hash FROM onboarding_applications WHERE id = ?",
    )
      .bind(applicationId)
      .first<{ application_secret_hash?: string | null }>();

    if (!result?.application_secret_hash) return false;

    const providedHash = await this.hashApplicationSecret(applicationSecret);
    return this.constantTimeEqual(result.application_secret_hash, providedHash);
  }

  /**
   * Activate an approved application and create the tenant.
   */
  private async activateApplication(applicationId: string): Promise<{
    success: boolean;
    tenantId?: string;
    subdomain?: string;
    ownerAccount?: ProvisionedOwnerAccount;
    error?: string;
  }> {
    const application = await this.getApplication(applicationId);

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    if (application.status !== "submitted") {
      return {
        success: false,
        error: `Cannot complete application with status: ${application.status}`,
      };
    }

    if (!application.assignedSubdomain) {
      return {
        success: false,
        error: "Assigned subdomain is missing",
      };
    }

    const now = new Date().toISOString();
    const previousStatus = application.status;
    let tenantId: string | undefined;
    let ownerAccount: ProvisionedOwnerAccount | undefined;

    try {
      // Update status to provisioning
      await this.updateApplicationStatus(applicationId, "provisioning");

      const tenant = await this.createTenantWithSubscription(application, now);
      tenantId = tenant.id;
      ownerAccount = await this.createPlatformOwnerAccount(
        application,
        tenant.id,
      );

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
        ownerAccount,
      };
    } catch (error) {
      console.error("[OnboardingService] Complete error:", error);

      if (ownerAccount) {
        await this.rollbackPlatformOwnerAccount(ownerAccount);
      }
      if (tenantId) {
        await this.rollbackTenantProvisioning(tenantId);
      }

      // Rollback status
      await this.updateApplicationStatus(applicationId, previousStatus);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete application",
      };
    }
  }

  async approveApplication(applicationId: string): Promise<{
    success: boolean;
    tenantId?: string;
    subdomain?: string;
    ownerAccount?: ProvisionedOwnerAccount;
    status?: OnboardingStatus;
    error?: string;
  }> {
    const application = await this.getApplication(applicationId);
    if (!application) return { success: false, error: "Application not found" };
    if (application.status === "completed") {
      return {
        success: true,
        tenantId: application.tenantId,
        subdomain: application.assignedSubdomain,
        status: "completed",
      };
    }
    if (application.status !== "submitted") {
      return {
        success: false,
        error: `Cannot approve application with status: ${application.status}`,
      };
    }

    const result = await this.activateApplication(applicationId);
    return {
      ...result,
      status: result.success ? "completed" : undefined,
    };
  }

  async rejectApplication(applicationId: string): Promise<{
    success: boolean;
    status?: OnboardingStatus;
    error?: string;
  }> {
    const application = await this.getApplication(applicationId);
    if (!application) return { success: false, error: "Application not found" };
    if (["completed", "provisioning"].includes(application.status)) {
      return {
        success: false,
        error: `Cannot reject application with status: ${application.status}`,
      };
    }

    await this.updateApplicationStatus(applicationId, "rejected");
    return { success: true, status: "rejected" };
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
    const random = randomBase36Upper(8);
    return `APP-${dateStr}-${random}`;
  }

  private generateApplicationSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `onb_${this.base64UrlEncode(bytes)}`;
  }

  private async hashApplicationSecret(secret: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(secret),
    );
    return `sha256:${this.base64UrlEncode(new Uint8Array(digest))}`;
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let index = 0; index < a.length; index++) {
      result |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return result === 0;
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
    const suffix = randomBase36(6);
    return base ? `${base}-${suffix}` : `tenant-${suffix}`;
  }

  private generateSubdomainSuggestions(base: string): string[] {
    const suggestions: string[] = [];
    const suffixes = [randomBase36(6), randomBase36(6), randomBase36(6)];

    for (const suffix of suffixes) {
      suggestions.push(`${base}-${suffix}`);
    }

    return suggestions;
  }

  private async createTenantWithSubscription(
    application: OnboardingApplication,
    nowIso: string,
  ) {
    const tenantId = this.generateTenantId();
    const tenantLicenseTier = this.toTenantLicenseTier(application.planId);
    const licenseKey = generateLicenseKey(tenantLicenseTier);
    const planTier = planIdToTier(application.planId);
    const nowMs = Date.now();
    const isTrial = planTier === "trial";
    const trialEndsAt = isTrial ? nowMs + TRIAL_DURATION_MS : null;
    const billingCycleStartAt = isTrial ? null : nowMs;
    const billingCycleEndAt = isTrial ? null : nowMs + DEFAULT_BILLING_CYCLE_MS;

    const tenantInsert = this.env.MANAGEMENT_DB.prepare(
      `INSERT INTO tenants (
        id, business_name, contact_email, contact_phone, latitude, longitude,
        subdomain, custom_domain, license_tier, license_key,
        status, activated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      tenantId,
      application.businessName,
      application.contactEmail,
      application.contactPhone || null,
      application.latitude ?? null,
      application.longitude ?? null,
      application.assignedSubdomain!,
      null,
      tenantLicenseTier,
      licenseKey,
      "active",
      nowIso,
      nowIso,
      nowIso,
    );

    const subscriptionInsert = this.env.MANAGEMENT_DB.prepare(
      `INSERT INTO shop_subscriptions (
        id, restaurant_id, plan_tier, module_overrides,
        is_active, trial_ends_at_ms, billing_cycle_start_at_ms,
        billing_cycle_end_at_ms, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      this.generateSubscriptionId(),
      tenantId,
      planTier,
      "{}",
      1,
      trialEndsAt,
      billingCycleStartAt,
      billingCycleEndAt,
      nowMs,
      nowMs,
    );

    await this.env.MANAGEMENT_DB.batch([tenantInsert, subscriptionInsert]);

    const tenant = await this.tenantService.getTenantById(tenantId);
    if (!tenant) {
      throw new Error("Tenant creation failed");
    }

    return tenant;
  }

  private async createPlatformOwnerAccount(
    application: OnboardingApplication,
    tenantId: string,
  ): Promise<ProvisionedOwnerAccount> {
    if (!this.env.PLATFORM_DB) {
      throw new Error("Platform DB binding is not configured");
    }

    const nowMs = Date.now();
    const restaurantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const username = await this.generateAvailableOwnerUsername(application);
    const initialPassword = this.generateInitialPassword();
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const restaurantInsert = this.env.PLATFORM_DB.prepare(
      `INSERT INTO restaurants (
        id, name, type, category, description, address, district, city, phone,
        email, latitude, longitude, is_available, is_active, created_at_ms,
        updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      restaurantId,
      application.businessName,
      "onboarding",
      "restaurant",
      `Provisioned from onboarding application ${application.id}`,
      "待補充",
      "待補充",
      "台中市",
      application.contactPhone || "00000000",
      application.contactEmail,
      application.latitude ?? null,
      application.longitude ?? null,
      1,
      1,
      nowMs,
      nowMs,
    );

    const userInsert = this.env.PLATFORM_DB.prepare(
      `INSERT INTO users (
        id, username, email, phone, full_name, password_hash, role,
        restaurant_id, is_active, is_verified, total_orders, total_spent,
        token_version, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      userId,
      username,
      application.contactEmail,
      application.contactPhone || null,
      application.contactName,
      passwordHash,
      1,
      restaurantId,
      1,
      0,
      0,
      0,
      1,
      nowMs,
      nowMs,
    );

    await this.env.PLATFORM_DB.batch([restaurantInsert, userInsert]);

    await this.env.MANAGEMENT_DB.prepare(
      `UPDATE tenants
       SET platform_restaurant_id = ?, owner_user_id = ?, owner_username = ?,
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        restaurantId,
        userId,
        username,
        new Date(nowMs).toISOString(),
        tenantId,
      )
      .run();

    return { restaurantId, userId, username, initialPassword };
  }

  private async rollbackPlatformOwnerAccount(
    ownerAccount: ProvisionedOwnerAccount,
  ): Promise<void> {
    if (!this.env.PLATFORM_DB) return;

    await this.env.PLATFORM_DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(ownerAccount.userId)
      .run();
    await this.env.PLATFORM_DB.prepare("DELETE FROM restaurants WHERE id = ?")
      .bind(ownerAccount.restaurantId)
      .run();
  }

  private async rollbackTenantProvisioning(tenantId: string): Promise<void> {
    await this.env.MANAGEMENT_DB.prepare(
      "DELETE FROM shop_subscriptions WHERE restaurant_id = ?",
    )
      .bind(tenantId)
      .run();
    await this.env.MANAGEMENT_DB.prepare("DELETE FROM tenants WHERE id = ?")
      .bind(tenantId)
      .run();
  }

  private async generateAvailableOwnerUsername(
    application: OnboardingApplication,
  ): Promise<string> {
    const base = this.slugifyUsername(
      application.contactEmail.split("@")[0] ||
        application.assignedSubdomain ||
        application.businessName,
    );

    for (let attempt = 0; attempt < 10; attempt++) {
      const username =
        attempt === 0 ? base : `${base}-${randomBase36(4).toLowerCase()}`;
      const existing = await this.env
        .PLATFORM_DB!.prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
        .bind(username)
        .first();
      if (!existing) return username;
    }

    return `${base}-${crypto.randomUUID().slice(0, 8)}`;
  }

  private slugifyUsername(value: string): string {
    const username = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    return username.length >= 3 ? username : `owner-${randomBase36(6)}`;
  }

  private generateInitialPassword(): string {
    return `Mkm-${randomBase36Upper(6)}-${randomBase36Upper(6)}!`;
  }

  private toTenantLicenseTier(planId: string | null | undefined): LicenseTier {
    if (planId === "professional" || planId === "enterprise") {
      return planId;
    }

    return "standard";
  }

  private generateTenantId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = randomBase36Upper(8);
    return `T-${dateStr}-${random}`;
  }

  private generateSubscriptionId(): string {
    return crypto.randomUUID();
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
      planId: row.plan_id as OnboardingPlanId | null,
      latitude: row.latitude as number | undefined,
      longitude: row.longitude as number | undefined,
      requestedSubdomain: row.requested_subdomain as string | undefined,
      assignedSubdomain: row.assigned_subdomain as string | undefined,
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
