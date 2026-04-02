/**
 * Tests for HomeView
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import HomeView from "@/views/HomeView.vue";

describe("HomeView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent() {
    return mount(HomeView, {
      global: {
        stubs: {
          RouterLink: {
            name: "RouterLink",
            props: ["to"],
            template: '<a :href="to" class="router-link"><slot /></a>',
          },
          CloudIcon: { template: "<svg />" },
          ShieldCheckIcon: { template: "<svg />" },
          CubeIcon: { template: "<svg />" },
          RocketLaunchIcon: { template: "<svg />" },
        },
      },
    });
  }

  it("should render the hero section with title", () => {
    const wrapper = mountComponent();

    expect(wrapper.find("h1").exists()).toBe(true);
    expect(wrapper.text()).toContain("專屬管理系統");
  });

  it("should render the description text", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("MakanMakan 獨立部署方案");
    expect(wrapper.text()).toContain("數據安全");
  });

  it("should render the apply button linking to /apply", () => {
    const wrapper = mountComponent();

    // The RouterLink stub renders an <a> tag with href from the "to" prop
    const allLinks = wrapper.findAll("a");
    const applyLink = allLinks.find(
      (link) => link.attributes("href") === "/apply",
    );
    expect(applyLink).toBeDefined();
    expect(applyLink!.text()).toContain("立即申請");
  });

  it("should render the demo link", () => {
    const wrapper = mountComponent();

    // demoUrl is built from VITE_CUSTOMER_APP_URL env var (defaults to http://localhost:3000)
    // so the href is dynamic. Find the link by its text content instead.
    const allLinks = wrapper.findAll("a");
    const demoLink = allLinks.find((link) => link.text().includes("查看演示"));
    expect(demoLink).toBeDefined();
    expect(demoLink!.attributes("target")).toBe("_blank");
  });

  it("should render 4 feature cards", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("獨立環境");
    expect(wrapper.text()).toContain("安全可靠");
    expect(wrapper.text()).toContain("完整功能");
    expect(wrapper.text()).toContain("快速部署");
  });

  it("should render feature descriptions", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("完全隔離的雲端環境");
    expect(wrapper.text()).toContain("Cloudflare 全球邊緣網絡");
    expect(wrapper.text()).toContain("點餐、菜單管理");
    expect(wrapper.text()).toContain("自動化部署流程");
  });

  it("should render the CTA section heading", () => {
    const wrapper = mountComponent();

    // HomeView does not have a pricing section — it has features + CTA
    expect(wrapper.find("h2").exists()).toBe(true);
    expect(wrapper.text()).toContain("準備好開始了嗎？");
  });

  it("should render the description paragraph below heading", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("填寫申請表單");
    expect(wrapper.text()).toContain("24 小時內");
  });

  it("should render feature card titles", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("獨立環境");
    expect(wrapper.text()).toContain("安全可靠");
    expect(wrapper.text()).toContain("完整功能");
    expect(wrapper.text()).toContain("快速部署");
  });

  it("should render feature card descriptions", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("完全隔離的雲端環境");
    expect(wrapper.text()).toContain("Cloudflare 全球邊緣網絡");
    expect(wrapper.text()).toContain("點餐、菜單管理");
    expect(wrapper.text()).toContain("自動化部署流程");
  });

  it("should render CTA section with apply link", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("準備好開始了嗎？");
    expect(wrapper.text()).toContain("開始申請");
  });

  it("should have multiple links to /apply across the page", () => {
    const wrapper = mountComponent();

    const applyLinks = wrapper
      .findAll("a")
      .filter((link) => link.attributes("href") === "/apply");

    // Hero CTA (立即申請) + bottom CTA (開始申請) = 2
    expect(applyLinks.length).toBeGreaterThanOrEqual(2);
  });
});
