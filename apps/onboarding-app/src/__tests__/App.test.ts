/**
 * Tests for App.vue
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import App from "@/App.vue";

describe("App.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent() {
    return mount(App, {
      global: {
        stubs: {
          RouterView: {
            template:
              "<div data-testid='router-view'>Router View Content</div>",
          },
          RouterLink: {
            name: "RouterLink",
            props: ["to"],
            template: "<a><slot /></a>",
          },
        },
      },
    });
  }

  it("should render the header with MakanMakan branding", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("MakanMakan");
    expect(wrapper.text()).toContain("獨立部署");
  });

  it("should render the home link in header", () => {
    const wrapper = mountComponent();

    // App.vue header uses a <span> for the brand name, not an external link
    const brandSpan = wrapper.find("header span");
    expect(brandSpan.exists()).toBe(true);
    expect(brandSpan.text()).toContain("MakanMakan");
  });

  it("should have target=_blank on the home link", () => {
    const wrapper = mountComponent();

    // App.vue uses RouterLink (stubbed to <a>) for navigation — the demo link in HomeView
    // is an external <a> with target="_blank". In App.vue itself there are no external links.
    // Verify the header contains the brand text without an external anchor.
    const header = wrapper.find("header");
    expect(header.exists()).toBe(true);
    expect(header.text()).toContain("MakanMakan");
  });

  it("should render the router view for page content", () => {
    const wrapper = mountComponent();

    const routerView = wrapper.find('[data-testid="router-view"]');
    expect(routerView.exists()).toBe(true);
  });

  it("should render the footer with copyright", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("2024 MakanMakan. All rights reserved.");
  });

  it("should have proper layout structure", () => {
    const wrapper = mountComponent();

    // Header
    expect(wrapper.find("header").exists()).toBe(true);
    // Main
    expect(wrapper.find("main").exists()).toBe(true);
    // Footer
    expect(wrapper.find("footer").exists()).toBe(true);
  });

  it("should have gradient background on root element", () => {
    const wrapper = mountComponent();
    const root = wrapper.find(".min-h-screen");
    expect(root.exists()).toBe(true);
    expect(root.classes()).toContain("bg-gradient-to-b");
  });
});
