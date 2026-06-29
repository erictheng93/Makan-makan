import { api, unwrapApiPayload } from "@/services/api";

export type OnboardingApplicationStatus =
  | "submitted"
  | "provisioning"
  | "completed"
  | "rejected";

export interface OnboardingApplication {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planId: "standard" | "professional" | "enterprise" | "trial" | null;
  latitude?: number | null;
  longitude?: number | null;
  requestedSubdomain?: string | null;
  assignedSubdomain?: string | null;
  status: OnboardingApplicationStatus;
  tenantId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
}

export interface OnboardingApplicationsResult {
  applications: OnboardingApplication[];
  total: number;
  page: number;
  limit: number;
}

export const onboardingApplicationsService = {
  async list(
    input: {
      status?: OnboardingApplicationStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<OnboardingApplicationsResult> {
    const response = await api.get<OnboardingApplicationsResult>(
      "/admin/onboarding/applications",
      input,
    );
    return unwrapApiPayload<OnboardingApplicationsResult>(response.data);
  },

  async approve(applicationId: string): Promise<{
    tenantId?: string;
    subdomain?: string;
    status: "completed";
  }> {
    const response = await api.post<{
      tenantId?: string;
      subdomain?: string;
      status: "completed";
    }>(`/admin/onboarding/applications/${applicationId}/approve`, {});
    return unwrapApiPayload<{
      tenantId?: string;
      subdomain?: string;
      status: "completed";
    }>(response.data);
  },

  async reject(applicationId: string): Promise<{ status: "rejected" }> {
    const response = await api.post<{ status: "rejected" }>(
      `/admin/onboarding/applications/${applicationId}/reject`,
      {},
    );
    return unwrapApiPayload<{ status: "rejected" }>(response.data);
  },
};
