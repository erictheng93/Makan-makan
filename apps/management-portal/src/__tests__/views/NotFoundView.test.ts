/**
 * NotFoundView Tests
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import NotFoundView from "@/views/NotFoundView.vue";

describe("NotFoundView", () => {
  it("renders 404 text", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("404");
  });

  it("renders page not found message", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("頁面不存在");
  });

  it("renders description text", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("您訪問的頁面可能已被移除或暫時無法使用");
  });

  it("renders home link pointing to /", () => {
    const wrapper = mount(NotFoundView);
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe("/");
  });

  it("renders home button text", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("返回首頁");
  });
});
