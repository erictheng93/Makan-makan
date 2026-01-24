/**
 * Onboarding Store
 * 客戶申請流程狀態管理
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  onboardingApi,
  ApiError,
  type CreateApplicationData,
  type CloudflarePermissions,
} from "@/services/api";

export interface ApplicationData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planId: "standard" | "professional" | "enterprise";
  subdomain?: string;
  status:
    | "pending"
    | "submitted"
    | "cf_verified"
    | "provisioning"
    | "completed";
}

export interface CloudflareInfo {
  accountId: string;
  apiToken: string;
  verified: boolean;
  permissions?: CloudflarePermissions;
}

export interface CompletionResult {
  tenantId: string;
  subdomain: string;
}

export const useOnboardingStore = defineStore("onboarding", () => {
  // ============================================================
  // State
  // ============================================================

  const application = ref<ApplicationData | null>(null);
  const applicationId = ref<string | null>(null);
  const assignedSubdomain = ref<string | null>(null);
  const cloudflareInfo = ref<CloudflareInfo | null>(null);
  const completionResult = ref<CompletionResult | null>(null);

  // Loading states
  const isLoading = ref(false);
  const isCheckingSubdomain = ref(false);
  const isVerifyingCf = ref(false);
  const isCompleting = ref(false);

  // Error state
  const apiError = ref<string | null>(null);

  // Subdomain availability
  const subdomainStatus = ref<
    "available" | "taken" | "checking" | "invalid" | null
  >(null);
  const subdomainSuggestions = ref<string[]>([]);

  // ============================================================
  // Computed
  // ============================================================

  const canVerifyCloudflare = computed(() => {
    return applicationId.value && application.value?.status === "submitted";
  });

  const canComplete = computed(() => {
    return applicationId.value && cloudflareInfo.value?.verified;
  });

  const isCompleted = computed(() => {
    return completionResult.value !== null;
  });

  // ============================================================
  // Actions
  // ============================================================

  /**
   * Check subdomain availability
   */
  async function checkSubdomain(subdomain: string): Promise<boolean> {
    if (!subdomain || subdomain.length < 3) {
      subdomainStatus.value = "invalid";
      return false;
    }

    // Validate format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      subdomainStatus.value = "invalid";
      return false;
    }

    isCheckingSubdomain.value = true;
    subdomainStatus.value = "checking";
    apiError.value = null;

    try {
      const result = await onboardingApi.checkSubdomain(subdomain);
      subdomainStatus.value = result.available ? "available" : "taken";
      subdomainSuggestions.value = result.suggestions || [];
      return result.available;
    } catch (error) {
      if (error instanceof ApiError) {
        apiError.value = error.message;
      }
      subdomainStatus.value = null;
      return false;
    } finally {
      isCheckingSubdomain.value = false;
    }
  }

  /**
   * Submit application
   */
  async function submitApplication(
    data: CreateApplicationData,
  ): Promise<boolean> {
    isLoading.value = true;
    apiError.value = null;

    try {
      const result = await onboardingApi.createApplication(data);

      applicationId.value = result.applicationId;
      assignedSubdomain.value = result.assignedSubdomain;
      application.value = {
        ...data,
        status: "submitted",
      };

      // Persist to session storage
      saveToSession();

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        apiError.value = error.message;
      } else {
        apiError.value = "Failed to submit application";
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Verify Cloudflare credentials
   */
  async function verifyCloudflare(
    accountId: string,
    apiToken: string,
  ): Promise<boolean> {
    if (!applicationId.value) {
      apiError.value = "No application ID";
      return false;
    }

    isVerifyingCf.value = true;
    apiError.value = null;

    try {
      const result = await onboardingApi.verifyCloudflare(
        applicationId.value,
        accountId,
        apiToken,
      );

      cloudflareInfo.value = {
        accountId,
        apiToken,
        verified: result.verified,
        permissions: result.permissions,
      };

      if (application.value) {
        application.value.status = "cf_verified";
        saveToSession();
      }

      return result.verified;
    } catch (error) {
      if (error instanceof ApiError) {
        apiError.value = error.message;
      } else {
        apiError.value = "Failed to verify Cloudflare credentials";
      }
      return false;
    } finally {
      isVerifyingCf.value = false;
    }
  }

  /**
   * Complete the application
   */
  async function completeApplication(): Promise<boolean> {
    if (!applicationId.value) {
      apiError.value = "No application ID";
      return false;
    }

    isCompleting.value = true;
    apiError.value = null;

    try {
      const result = await onboardingApi.completeApplication(
        applicationId.value,
      );

      completionResult.value = {
        tenantId: result.tenantId,
        subdomain: result.subdomain,
      };

      if (application.value) {
        application.value.status = "completed";
        saveToSession();
      }

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        apiError.value = error.message;
      } else {
        apiError.value = "Failed to complete application";
      }
      return false;
    } finally {
      isCompleting.value = false;
    }
  }

  /**
   * Set application data (for form persistence)
   */
  function setApplication(data: ApplicationData) {
    application.value = data;
    saveToSession();
  }

  /**
   * Set cloudflare info (without verification)
   */
  function setCloudflareInfo(info: CloudflareInfo) {
    cloudflareInfo.value = info;
    // Don't persist sensitive info
  }

  /**
   * Load from session storage
   */
  function loadFromSession() {
    const stored = sessionStorage.getItem("onboarding_application");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        application.value = data.application || null;
        applicationId.value = data.applicationId || null;
        assignedSubdomain.value = data.assignedSubdomain || null;
        completionResult.value = data.completionResult || null;
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Save to session storage
   */
  function saveToSession() {
    const data = {
      application: application.value,
      applicationId: applicationId.value,
      assignedSubdomain: assignedSubdomain.value,
      completionResult: completionResult.value,
    };
    sessionStorage.setItem("onboarding_application", JSON.stringify(data));
  }

  /**
   * Reset all state
   */
  function reset() {
    application.value = null;
    applicationId.value = null;
    assignedSubdomain.value = null;
    cloudflareInfo.value = null;
    completionResult.value = null;
    apiError.value = null;
    subdomainStatus.value = null;
    subdomainSuggestions.value = [];
    sessionStorage.removeItem("onboarding_application");
  }

  /**
   * Clear error
   */
  function clearError() {
    apiError.value = null;
  }

  // Initialize from session
  loadFromSession();

  return {
    // State
    application,
    applicationId,
    assignedSubdomain,
    cloudflareInfo,
    completionResult,
    isLoading,
    isCheckingSubdomain,
    isVerifyingCf,
    isCompleting,
    apiError,
    subdomainStatus,
    subdomainSuggestions,

    // Computed
    canVerifyCloudflare,
    canComplete,
    isCompleted,

    // Actions
    checkSubdomain,
    submitApplication,
    verifyCloudflare,
    completeApplication,
    setApplication,
    setCloudflareInfo,
    loadFromSession,
    reset,
    clearError,
  };
});
