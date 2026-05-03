import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ModuleGate from "../../../../packages/shared/components/ModuleGate.vue";
import { useModuleAccessStore } from "../../../../packages/shared/stores/moduleAccess";

function setAccess(options: {
  isLoaded: boolean;
  effectiveModules?: Record<string, boolean>;
}) {
  const store = useModuleAccessStore();
  store.data = {
    restaurantId: "rest-1",
    planTier: "pro",
    isActive: true,
    trialEndsAt: null,
    deploymentMode: "managed",
    effectiveModules: options.effectiveModules ?? {},
  };
  store.isLoaded = options.isLoaded;
  return store;
}

describe("ModuleGate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the default slot when the module is enabled", () => {
    setAccess({ isLoaded: true, effectiveModules: { analytics: true } });

    const wrapper = mount(ModuleGate, {
      props: { module: "analytics" },
      slots: {
        default: '<section data-test="content">Analytics</section>',
        fallback: '<section data-test="fallback">Upgrade</section>',
      },
    });

    expect(wrapper.find("[data-test='content']").exists()).toBe(true);
    expect(wrapper.find("[data-test='fallback']").exists()).toBe(false);
  });

  it("renders the fallback slot when the module is disabled", () => {
    setAccess({ isLoaded: true, effectiveModules: { analytics: false } });

    const wrapper = mount(ModuleGate, {
      props: { module: "analytics" },
      slots: {
        default: '<section data-test="content">Analytics</section>',
        fallback: '<section data-test="fallback">Upgrade</section>',
      },
    });

    expect(wrapper.find("[data-test='content']").exists()).toBe(false);
    expect(wrapper.find("[data-test='fallback']").exists()).toBe(true);
  });

  it("renders the loading slot before access data has loaded", () => {
    setAccess({ isLoaded: false });

    const wrapper = mount(ModuleGate, {
      props: { module: "analytics" },
      slots: {
        default: '<section data-test="content">Analytics</section>',
        loading: '<section data-test="loading">Loading</section>',
      },
    });

    expect(wrapper.find("[data-test='content']").exists()).toBe(false);
    expect(wrapper.find("[data-test='loading']").exists()).toBe(true);
  });
});
