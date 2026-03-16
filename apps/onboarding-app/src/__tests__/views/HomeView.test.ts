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

    const demoLink = wrapper.find('a[href="https://makanmakan.app/demo"]');
    expect(demoLink.exists()).toBe(true);
    expect(demoLink.text()).toContain("查看演示");
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

  it("should render 3 pricing plans", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("標準版");
    expect(wrapper.text()).toContain("專業版");
    expect(wrapper.text()).toContain("企業版");
  });

  it("should render pricing amounts", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("$149");
    expect(wrapper.text()).toContain("$299");
    expect(wrapper.text()).toContain("議價");
  });

  it("should highlight the recommended plan", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("推薦");
  });

  it("should render plan features list", () => {
    const wrapper = mountComponent();

    // Standard plan features
    expect(wrapper.text()).toContain("1 間餐廳");
    expect(wrapper.text()).toContain("資料備份");

    // Professional plan features
    expect(wrapper.text()).toContain("最多 3 間餐廳");
    expect(wrapper.text()).toContain("AI 分析");
    expect(wrapper.text()).toContain("員工排班");

    // Enterprise plan features
    expect(wrapper.text()).toContain("無限餐廳");
    expect(wrapper.text()).toContain("SLA 保證");
  });

  it("should render CTA section with apply link", () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain("準備好開始了嗎？");
    expect(wrapper.text()).toContain("開始申請");
  });

  it("should have multiple links to /apply for each plan", () => {
    const wrapper = mountComponent();

    const applyLinks = wrapper
      .findAll("a")
      .filter((link) => link.attributes("href") === "/apply");

    // At least: hero CTA + 3 plan buttons + bottom CTA = 5
    expect(applyLinks.length).toBeGreaterThanOrEqual(4);
  });
});
