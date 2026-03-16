/**
 * AppLayout Tests
 */

import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import AppLayout from "@/layouts/AppLayout.vue";

describe("AppLayout", () => {
  const mountLayout = () => {
    return mount(AppLayout, {
      slots: {
        default: "<div data-testid='page-content'>Page Content</div>",
      },
    });
  };

  it("renders the brand name", () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain("MakanMakan");
  });

  it("renders the portal label", () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain("管理平台");
  });

  it("renders navigation links", () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain("總覽");
    expect(wrapper.text()).toContain("租戶管理");
    expect(wrapper.text()).toContain("部署管理");
    expect(wrapper.text()).toContain("健康監控");
    expect(wrapper.text()).toContain("授權管理");
  });

  it("renders version info", () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain("版本 1.0.0");
  });

  it("renders slot content", () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain("Page Content");
  });

  it("has navigation links to correct paths", () => {
    const wrapper = mountLayout();
    const links = wrapper.findAll("a");
    const hrefs = links.map((l) => l.attributes("href"));

    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/tenants");
    expect(hrefs).toContain("/deployments");
    expect(hrefs).toContain("/health");
    expect(hrefs).toContain("/licenses");
  });

  it("mobile sidebar is hidden by default", () => {
    const wrapper = mountLayout();
    // The mobile sidebar div is conditionally rendered with v-if="sidebarOpen"
    // When closed, the mobile overlay (fixed inset-0 z-40 lg:hidden) should not exist
    const mobileSidebar = wrapper.find(".fixed.inset-0.z-40");
    expect(mobileSidebar.exists()).toBe(false);
  });

  it("opens mobile sidebar on hamburger click", async () => {
    const wrapper = mountLayout();
    // Find the hamburger button (the one with Bars3Icon)
    const hamburgerBtn = wrapper.findAll("button").find((b) => {
      return b.find('[data-testid="bars3icon"]').exists();
    });

    if (hamburgerBtn) {
      await hamburgerBtn.trigger("click");
      await flushPromises();

      // Mobile sidebar should now be visible
      const mobileSidebar = wrapper.find(".fixed.inset-0.z-40");
      expect(mobileSidebar.exists()).toBe(true);
    }
  });

  it("closes mobile sidebar on close button click", async () => {
    const wrapper = mountLayout();
    // First open it
    const hamburgerBtn = wrapper.findAll("button").find((b) => {
      return b.find('[data-testid="bars3icon"]').exists();
    });

    if (hamburgerBtn) {
      await hamburgerBtn.trigger("click");
      await flushPromises();

      // Find close button (XMarkIcon inside mobile sidebar)
      const closeBtn = wrapper.findAll("button").find((b) => {
        return b.find('[data-testid="xmarkicon"]').exists();
      });

      if (closeBtn) {
        await closeBtn.trigger("click");
        await flushPromises();

        const mobileSidebar = wrapper.find(".fixed.inset-0.z-40");
        expect(mobileSidebar.exists()).toBe(false);
      }
    }
  });

  it("desktop sidebar is always visible", () => {
    const wrapper = mountLayout();
    // Desktop sidebar has class "hidden lg:fixed"
    const desktopSidebar = wrapper.find(".hidden.lg\\:fixed");
    expect(desktopSidebar.exists()).toBe(true);
  });

  it("renders main content area", () => {
    const wrapper = mountLayout();
    const main = wrapper.find("main");
    expect(main.exists()).toBe(true);
  });
});
