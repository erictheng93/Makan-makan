import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { onboardingApplicationsService } from "./onboardingApplicationsService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiPayload: (payload: { data?: unknown }) => payload.data ?? payload,
}));

describe("onboardingApplicationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists onboarding applications with filters", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          applications: [
            {
              id: "APP-1",
              businessName: "Laksa Shop",
              contactName: "Tan Mei",
              contactEmail: "tan@example.test",
              contactPhone: "0912345678",
              planId: "trial",
              assignedSubdomain: "laksa",
              status: "submitted",
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 25,
        },
      },
    } as never);

    const result = await onboardingApplicationsService.list({
      status: "submitted",
      page: 1,
      limit: 25,
    });

    expect(api.get).toHaveBeenCalledWith("/admin/onboarding/applications", {
      status: "submitted",
      page: 1,
      limit: 25,
    });
    expect(result.applications[0]).toMatchObject({
      id: "APP-1",
      businessName: "Laksa Shop",
    });
  });

  it("approves and rejects onboarding applications", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: {
          data: {
            tenantId: "T-1",
            subdomain: "laksa",
            ownerAccount: {
              restaurantId: "restaurant-1",
              userId: "owner-1",
              username: "tan",
              initialPassword: "Mkm-ABCDEF-GHIJKL!",
            },
            status: "completed",
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: { data: { status: "rejected" } },
      } as never);

    const approveResult = await onboardingApplicationsService.approve("APP-1");
    await onboardingApplicationsService.reject("APP-2");

    expect(approveResult.ownerAccount).toMatchObject({
      username: "tan",
      initialPassword: "Mkm-ABCDEF-GHIJKL!",
    });
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/admin/onboarding/applications/APP-1/approve",
      {},
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/admin/onboarding/applications/APP-2/reject",
      {},
    );
  });
});
