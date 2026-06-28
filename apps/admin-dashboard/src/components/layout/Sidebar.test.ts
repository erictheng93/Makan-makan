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
    authState.isAdminRole = true;
    authState.hasRestaurantContext = false;
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

    expect(wrapper.text()).toContain("nav.platform");
    expect(wrapper.text()).toContain("nav.selectRestaurantFirst");
    expect(wrapper.text()).not.toContain("nav.dashboard");
    expect(wrapper.text()).not.toContain("nav.ownerOverview");
    expect(wrapper.text()).not.toContain("nav.pos");
    expect(wrapper.text()).not.toContain("nav.orders");
    expect(wrapper.text()).not.toContain("nav.menu");
  });

  it("shows restaurant navigation under a shop section after selection", () => {
    authState.hasRestaurantContext = true;

    const wrapper = mountSidebar();

    expect(wrapper.text()).toContain("nav.restaurantManagement");
    expect(wrapper.text()).toContain("nav.dashboard");
    expect(wrapper.text()).toContain("nav.ownerOverview");
    expect(wrapper.text()).toContain("nav.pos");
    expect(wrapper.text()).toContain("nav.orders");
    expect(wrapper.text()).toContain("nav.menu");
    expect(wrapper.text()).not.toContain("nav.selectRestaurantFirst");
  });
});
