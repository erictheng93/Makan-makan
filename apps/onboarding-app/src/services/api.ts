/**
 * Onboarding API Service
 * Handles communication with the Management API
 */

import axios, { AxiosError } from "axios";

function resolveApiBase(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase) {
    return apiBase;
  }

  if (import.meta.env.PROD) {
    throw new Error("VITE_API_URL is required for production builds");
  }

  return "/api/v1";
}

const API_BASE = resolveApiBase();

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// ============================================================
// Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Array<{ path: string[]; message: string }>;
}

export interface CreateApplicationData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planId: "standard" | "professional" | "enterprise";
  subdomain?: string;
  latitude: number;
  longitude: number;
}

export interface ApplicationResponse {
  applicationId: string;
  applicationSecret: string;
  assignedSubdomain: string;
  status: string;
}

export interface SubdomainCheckResponse {
  subdomain: string;
  available: boolean;
  suggestions?: string[];
}

export interface CloudflarePermissions {
  workers: boolean;
  d1: boolean;
  kv: boolean;
  r2: boolean;
  pages: boolean;
}

export interface VerifyCloudflareResponse {
  verified: boolean;
  permissions: CloudflarePermissions;
}

export interface CompleteApplicationResponse {
  tenantId: string;
  subdomain: string;
  status: string;
}

export interface ApplicationDetails {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  latitude: number;
  longitude: number;
  planId: string;
  assignedSubdomain: string;
  status: string;
  cfVerifiedAt?: string;
  tenantId?: string;
  createdAt: string;
  completedAt?: string;
}

// ============================================================
// API Error Handling
// ============================================================

export class ApiError extends Error {
  code: string;
  details?: Array<{ path: string[]; message: string }>;

  constructor(
    message: string,
    code: string,
    details?: Array<{ path: string[]; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

function handleApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>;
    const response = axiosError.response?.data;

    if (response) {
      throw new ApiError(
        response.error || "Request failed",
        response.code || "UNKNOWN_ERROR",
        response.details,
      );
    }

    if (axiosError.code === "ECONNABORTED") {
      throw new ApiError("Request timed out", "TIMEOUT");
    }

    if (!axiosError.response) {
      throw new ApiError(
        "Network error - please check your connection",
        "NETWORK_ERROR",
      );
    }
  }

  throw new ApiError("An unexpected error occurred", "UNKNOWN_ERROR");
}

// ============================================================
// API Methods
// ============================================================

export const onboardingApi = {
  /**
   * Check if a subdomain is available
   */
  async checkSubdomain(subdomain: string): Promise<SubdomainCheckResponse> {
    try {
      const response = await apiClient.get<ApiResponse<SubdomainCheckResponse>>(
        "/onboarding/subdomain/check",
        { params: { subdomain } },
      );

      if (!response.data.success || !response.data.data) {
        throw new ApiError(
          response.data.error || "Failed to check subdomain",
          response.data.code || "CHECK_FAILED",
        );
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      handleApiError(error);
    }
  },

  /**
   * Create a new onboarding application
   */
  async createApplication(
    data: CreateApplicationData,
  ): Promise<ApplicationResponse> {
    try {
      const response = await apiClient.post<ApiResponse<ApplicationResponse>>(
        "/onboarding/applications",
        data,
      );

      if (!response.data.success || !response.data.data) {
        throw new ApiError(
          response.data.error || "Failed to create application",
          response.data.code || "CREATE_FAILED",
          response.data.details,
        );
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      handleApiError(error);
    }
  },

  /**
   * Get application details
   */
  async getApplication(
    applicationId: string,
    applicationSecret: string,
  ): Promise<ApplicationDetails> {
    try {
      const response = await apiClient.get<ApiResponse<ApplicationDetails>>(
        `/onboarding/applications/${applicationId}`,
        {
          headers: { "X-Onboarding-Secret": applicationSecret },
        },
      );

      if (!response.data.success || !response.data.data) {
        throw new ApiError(
          response.data.error || "Application not found",
          response.data.code || "NOT_FOUND",
        );
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      handleApiError(error);
    }
  },

  /**
   * Verify Cloudflare credentials
   */
  async verifyCloudflare(
    applicationId: string,
    accountId: string,
    apiToken: string,
    applicationSecret: string,
  ): Promise<VerifyCloudflareResponse> {
    try {
      const response = await apiClient.post<
        ApiResponse<VerifyCloudflareResponse>
      >(
        `/onboarding/applications/${applicationId}/verify-cloudflare`,
        {
          accountId,
          apiToken,
        },
        {
          headers: { "X-Onboarding-Secret": applicationSecret },
        },
      );

      if (!response.data.success || !response.data.data) {
        throw new ApiError(
          response.data.error || "Cloudflare verification failed",
          response.data.code || "CF_VERIFICATION_FAILED",
        );
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      handleApiError(error);
    }
  },

  /**
   * Complete application and create tenant
   */
  async completeApplication(
    applicationId: string,
    applicationSecret: string,
  ): Promise<CompleteApplicationResponse> {
    try {
      const response = await apiClient.post<
        ApiResponse<CompleteApplicationResponse>
      >(
        `/onboarding/applications/${applicationId}/complete`,
        {},
        {
          headers: { "X-Onboarding-Secret": applicationSecret },
        },
      );

      if (!response.data.success || !response.data.data) {
        throw new ApiError(
          response.data.error || "Failed to complete application",
          response.data.code || "COMPLETE_FAILED",
        );
      }

      return response.data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      handleApiError(error);
    }
  },
};

export default onboardingApi;
