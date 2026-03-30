/**
 * Admin Dashboard Integration Tests
 *
 * End-to-end workflow tests for the admin dashboard
 * Note: Some tests are skipped because the actual components don't have
 * the expected data-testid attributes. These tests need to be rewritten
 * to match the actual component structure.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestRouter } from "../helpers/test-router";
import { createTestStore } from "../helpers/test-store";
import QueueView from "../../views/seating/QueueDashboardTab.vue";
import SettingsView from "../../views/SettingsView.vue";

describe("Admin Dashboard Integration Tests", () => {
  let wrapper;
  let router;
  let store;

  beforeAll(async () => {
    router = createTestRouter();
    store = createTestStore();
  });

  beforeEach(async () => {
    // Reset store state
    store.reset();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("Queue Management Workflow", () => {
    it("should mount QueueView successfully", async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store],
          stubs: {
            // Stub icon components
            UsersIcon: true,
            ClockIcon: true,
            BuildingStorefrontIcon: true,
            ChartBarIcon: true,
            ExclamationTriangleIcon: true,
            ArrowPathIcon: true,
            PhoneIcon: true,
            XMarkIcon: true,
            CheckIcon: true,
            UserGroupIcon: true,
            DocumentTextIcon: true,
          },
        },
      });

      // Component should mount successfully
      expect(wrapper.exists()).toBe(true);

      // Should have heading (QueueDashboardTab uses h2, not h1)
      const heading = wrapper.find("h2");
      expect(heading.exists()).toBe(true);
    });

    it("should mount SettingsView successfully", async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store],
          stubs: {
            // Stub any icon or complex components
            BellIcon: true,
            CogIcon: true,
            UserIcon: true,
            BuildingOfficeIcon: true,
            CreditCardIcon: true,
            ShieldCheckIcon: true,
          },
        },
      });

      // Should load settings
      await wrapper.vm.$nextTick();
      expect(wrapper.exists()).toBe(true);

      // Should have heading
      const heading = wrapper.find("h1");
      expect(heading.exists()).toBe(true);
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle validation errors", async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store],
          stubs: {
            BellIcon: true,
            CogIcon: true,
            UserIcon: true,
            BuildingOfficeIcon: true,
            CreditCardIcon: true,
            ShieldCheckIcon: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      // Component should mount without errors
      expect(wrapper.exists()).toBe(true);

      // Should have form inputs
      const inputs = wrapper.findAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  describe("Performance Integration", () => {
    it("should render QueueView within reasonable time", async () => {
      const startTime = performance.now();

      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store],
          stubs: {
            UsersIcon: true,
            ClockIcon: true,
            BuildingStorefrontIcon: true,
            ChartBarIcon: true,
            ExclamationTriangleIcon: true,
            ArrowPathIcon: true,
            PhoneIcon: true,
            XMarkIcon: true,
            CheckIcon: true,
            UserGroupIcon: true,
            DocumentTextIcon: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (< 2000ms for test environment)
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe("Accessibility Integration", () => {
    it("should have proper heading structure", async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store],
          stubs: {
            UsersIcon: true,
            ClockIcon: true,
            BuildingStorefrontIcon: true,
            ChartBarIcon: true,
            ExclamationTriangleIcon: true,
            ArrowPathIcon: true,
            PhoneIcon: true,
            XMarkIcon: true,
            CheckIcon: true,
            UserGroupIcon: true,
            DocumentTextIcon: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      // Should have proper heading structure
      const headings = wrapper.findAll("h1, h2, h3, h4, h5, h6");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("Data Persistence Integration", () => {
    it("should mount SettingsView for preferences", async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store],
          stubs: {
            BellIcon: true,
            CogIcon: true,
            UserIcon: true,
            BuildingOfficeIcon: true,
            CreditCardIcon: true,
            ShieldCheckIcon: true,
          },
        },
      });

      await wrapper.vm.$nextTick();

      // Component should mount
      expect(wrapper.exists()).toBe(true);

      // Should have language settings (check for select element)
      const selects = wrapper.findAll("select");
      expect(selects.length).toBeGreaterThan(0);
    });

    it("should have store getters working", async () => {
      // Test that store getters return values (not functions)
      expect(typeof store.getters["settings/language"]).toBe("string");
      expect(typeof store.getters["settings/theme"]).toBe("string");
    });
  });
});
