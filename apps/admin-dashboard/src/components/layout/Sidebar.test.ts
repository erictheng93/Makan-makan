// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar.vue";

const routeState = reactive({
  path: "/dashboard/platform",
});

const authState = reactive({
  user: { username: "admin", role: 0 },
  isAdminRole: true,
  hasRestaurantContext: false,
  canAccessOwnerDashboard: true,
  canManageOrders: true,
  canManageMenu: true,
  canAccessAdminFeatures: true,
});

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    get user() {
      return authState.user;
    },
    get isAdminRole() {
      return authState.isAdminRole;
    },
    get hasRestaurantContext() {
      return authState.hasRestaurantContext;
    },
    get canAccessOwnerDashboard() {
      return authState.canAccessOwnerDashboard;
    },
    get canManageOrders() {
      return authState.canManageOrders;
    },
    get canManageMenu() {
      return authState.canManageMenu;
    },
    get canAccessAdminFeatures() {
      return authState.canAccessAdminFeatures;
    },
    hasPermission: vi.fn(() => true),
  }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  RouterLink: {
    props: ["to"],
    template: "<a><slot /></a>",
  },
}));

describe("Sidebar", () => {
  beforeEach(() => {
    routeState.path = "/dashboard/platform";
    authState.user = { username: "admin", role: 0 };
    authState.isAdminRole = true;
    authState.hasRestaurantContext = false;
    authState.canAccessOwnerDashboard = true;
    authState.canManageOrders = true;
    authState.canManageMenu = true;
    authState.canAccessAdminFeatures = true;
  });

  function mountSidebar() {
    return mount(Sidebar, {
      props: {
        isCollapsed: false,
      },
      global: {
        stubs: {
          ModuleGate: {
            template: "<div><slot /></div>",
          },
          "router-link": {
            props: ["to"],
            template: "<a><slot /></a>",
          },
        },
      },
    });
  }

  it("hides restaurant navigation for admins without restaurant context", () => {
    const wrapper = mountSidebar();

    expect(wrapper.find('[data-testid="nav-item-platform"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="restaurant-context-hint"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="nav-item-dashboard"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="nav-item-owner-overview"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="nav-item-pos"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-item-orders"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="nav-item-menu"]').exists()).toBe(false);
  });

  it("shows restaurant navigation under a shop section after selection", () => {
    authState.hasRestaurantContext = true;

    const wrapper = mountSidebar();
    const sectionLabel = wrapper.find(
      '[data-testid="restaurant-section-label"]',
    );
    const dashboardItem = wrapper.find('[data-testid="nav-item-dashboard"]');

    expect(sectionLabel.exists()).toBe(true);
    expect(dashboardItem.exists()).toBe(true);
    expect(
      sectionLabel.element.compareDocumentPosition(dashboardItem.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wrapper.find('[data-testid="nav-item-owner-overview"]').exists(),
    ).toBe(true);
    expect(wrapper.find('[data-testid="nav-item-pos"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-item-orders"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-item-menu"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="restaurant-context-hint"]').exists(),
    ).toBe(false);
  });

  it("does not show an orphan shop section for non-admin users", () => {
    authState.user = { username: "owner", role: 1 };
    authState.isAdminRole = false;
    authState.hasRestaurantContext = true;

    const wrapper = mountSidebar();

    expect(wrapper.find('[data-testid="nav-item-platform"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="nav-item-dashboard"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="restaurant-section-label"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="restaurant-context-hint"]').exists(),
    ).toBe(false);
  });
});
