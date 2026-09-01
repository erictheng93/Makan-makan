// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MembersView from "./MembersView.vue";

const list = vi.hoisted(() => vi.fn());
const stats = vi.hoisted(() => vi.fn());

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "shop-a" }),
}));
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}));
vi.mock("@/services/membersService", () => ({
  membersService: { list, stats },
}));

describe("MembersView", () => {
  it("renders the tenant member row with masked contact details", async () => {
    list.mockResolvedValue({
      data: [
        {
          memberId: "member-a",
          displayName: "Alice",
          maskedPhone: "0912***678",
          maskedEmail: "a***@example.com",
          orderCount: 3,
          cancelledOrderCount: 1,
          totalSpentCents: 1200,
          lastOrderAt: null,
          status: "active",
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    stats.mockResolvedValue({
      totalMembers: 1,
      newThisMonth: 1,
      repeatRate: 1,
      avgOrderValueCents: 400,
    });

    const wrapper = mount(MembersView);
    await flushPromises();

    expect(wrapper.get('[data-testid="member-row-member-a"]').text()).toContain(
      "Alice",
    );
    expect(wrapper.text()).toContain("0912***678");
    expect(wrapper.text()).toContain("a***@example.com");
    expect(
      wrapper
        .get('[data-testid="member-row-member-a"]')
        .attributes("data-status"),
    ).toBe("active");
  });
});
