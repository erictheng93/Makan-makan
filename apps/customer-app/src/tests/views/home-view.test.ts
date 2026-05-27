import { mount, RouterLinkStub } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import HomeView from "@/views/HomeView.vue";

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    error: vi.fn(),
  }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/app", () => ({
  useAppStore: () => ({
    isInstallable: false,
    installApp: vi.fn(),
  }),
}));

vi.mock("@/components/LanguageSwitcher.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/ManualInputModal.vue", () => ({
  default: { template: "<div />" },
}));

describe("HomeView", () => {
  it("links customers to the full market directory", () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          LanguageSwitcher: true,
          ManualInputModal: true,
        },
      },
    });

    const link = wrapper.get('[data-testid="market-directory-link"]');

    expect(link.text()).toContain("夜市與商圈");
    expect(
      wrapper
        .findAllComponents(RouterLinkStub)
        .some((routerLink) => routerLink.props("to") === "/markets"),
    ).toBe(true);
  });
});
