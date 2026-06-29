import { managementApi, unwrapApiPayload } from "@/services/api";

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

export interface ProvisionedOwnerAccount {
  restaurantId: string;
  userId: string;
  username: string;
  setupPasswordToken: string;
  setupPasswordLink: string;
  setupPasswordExpiresAt: string;
}

export interface ApproveOnboardingApplicationResult {
  tenantId?: string;
  subdomain?: string;
  ownerAccount?: ProvisionedOwnerAccount;
  status: "completed";
}

export const onboardingApplicationsService = {
  async list(
    input: {
      status?: OnboardingApplicationStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<OnboardingApplicationsResult> {
    const response = await managementApi.get<OnboardingApplicationsResult>(
      "/admin/onboarding/applications",
      input,
    );
    return unwrapApiPayload<OnboardingApplicationsResult>(response.data);
  },

  async approve(
    applicationId: string,
  ): Promise<ApproveOnboardingApplicationResult> {
    const response =
      await managementApi.post<ApproveOnboardingApplicationResult>(
        `/admin/onboarding/applications/${applicationId}/approve`,
        {},
      );
    return unwrapApiPayload<ApproveOnboardingApplicationResult>(response.data);
  },

  async reject(applicationId: string): Promise<{ status: "rejected" }> {
    const response = await managementApi.post<{ status: "rejected" }>(
      `/admin/onboarding/applications/${applicationId}/reject`,
      {},
    );
    return unwrapApiPayload<{ status: "rejected" }>(response.data);
  },
};
