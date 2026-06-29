// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformOnboardingApplicationsView from "./PlatformOnboardingApplicationsView.vue";
import { onboardingApplicationsService } from "@/services/onboardingApplicationsService";

vi.mock("@/services/onboardingApplicationsService", () => ({
  onboardingApplicationsService: {
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}));

describe("PlatformOnboardingApplicationsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onboardingApplicationsService.list).mockResolvedValue({
      applications: [
        {
          id: "APP-1",
          businessName: "Laksa Shop",
          contactName: "Tan Mei",
          contactEmail: "tan@example.test",
          contactPhone: "0912345678",
          planId: "trial",
          latitude: 24.147736,
          longitude: 120.673648,
          assignedSubdomain: "laksa",
          status: "submitted",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
    vi.mocked(onboardingApplicationsService.approve).mockResolvedValue({
      tenantId: "T-1",
      subdomain: "laksa",
      ownerAccount: {
        restaurantId: "restaurant-1",
        userId: "owner-1",
        username: "tan",
        setupPasswordToken: "setup-token",
        setupPasswordLink:
          "https://admin.example.test/reset-password?token=setup-token",
        setupPasswordExpiresAt: "2026-06-30T00:00:00.000Z",
      },
      status: "completed",
    });
    vi.mocked(onboardingApplicationsService.reject).mockResolvedValue({
      status: "rejected",
    });
  });

  it("loads onboarding applications and filters by submitted status by default", async () => {
    const wrapper = mount(PlatformOnboardingApplicationsView);
    await vi.dynamicImportSettled();

    expect(onboardingApplicationsService.list).toHaveBeenCalledWith({
      status: "submitted",
      limit: 50,
    });
    expect(wrapper.text()).toContain("Laksa Shop");
    expect(wrapper.text()).toContain("待審核");
  });

  it("approves and rejects applications then refreshes the list", async () => {
    const wrapper = mount(PlatformOnboardingApplicationsView);
    await vi.dynamicImportSettled();

    await wrapper
      .get('[data-testid="approve-onboarding-APP-1"]')
      .trigger("click");
    await vi.dynamicImportSettled();

    expect(onboardingApplicationsService.approve).toHaveBeenCalledWith("APP-1");
    expect(onboardingApplicationsService.list).toHaveBeenCalledTimes(2);
    expect(
      wrapper.get('[data-testid="approved-owner-account"]').text(),
    ).toContain("tan");
    expect(
      wrapper.get('[data-testid="approved-owner-account"]').text(),
    ).toContain("https://admin.example.test/reset-password?token=setup-token");

    await wrapper
      .get('[data-testid="reject-onboarding-APP-1"]')
      .trigger("click");
    await vi.dynamicImportSettled();

    expect(onboardingApplicationsService.reject).toHaveBeenCalledWith("APP-1");
    expect(onboardingApplicationsService.list).toHaveBeenCalledTimes(3);
  });

  it("allows approving submitted applications in the managed onboarding flow", async () => {
    vi.mocked(onboardingApplicationsService.list).mockResolvedValue({
      applications: [
        {
          id: "APP-2",
          businessName: "Nasi Lemak Shop",
          contactName: "Chen Wei",
          contactEmail: "chen@example.test",
          contactPhone: "0987654321",
          planId: "standard",
          latitude: null,
          longitude: null,
          assignedSubdomain: "nasi-lemak",
          status: "submitted",
          createdAt: "2026-06-02T00:00:00.000Z",
          updatedAt: "2026-06-02T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });

    const wrapper = mount(PlatformOnboardingApplicationsView);
    await vi.dynamicImportSettled();

    const approveButton = wrapper.get(
      '[data-testid="approve-onboarding-APP-2"]',
    );
    expect(approveButton.attributes("disabled")).toBeUndefined();
    expect(wrapper.get('[data-testid="approvable-count"]').text()).toBe("1");

    await approveButton.trigger("click");
    await vi.dynamicImportSettled();

    expect(onboardingApplicationsService.approve).toHaveBeenCalledWith("APP-2");
  });
});
