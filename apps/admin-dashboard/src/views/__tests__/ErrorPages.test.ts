/**
 * Error Pages Tests
 * Tests for NotFoundView (404) and UnauthorizedView (403) pages.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "notFound.title": "頁面未找到",
        "notFound.description": "您訪問的頁面不存在",
        "notFound.instruction": "請檢查網址是否正確",
        "notFound.attemptedPath": "嘗試訪問的路徑",
        "notFound.quickNav": "快速導航",
        "notFound.goBack": "返回上一頁",
        "notFound.goHome": "返回首頁",
        "notFound.cantFind": "找不到頁面？",
        "notFound.trySearch": "嘗試搜索",
        "notFound.searchPlaceholder": "搜索...",
        "notFound.search": "搜索",
        "notFound.persistentIssue": "持續問題？",
        "notFound.techSupport": "技術支持",
        "notFound.contactPhone": "聯繫電話",
        "notFound.errorCode": "錯誤代碼",
        "nav.dashboard": "儀表板",
        "nav.orders": "訂單",
        "nav.menu": "菜單",
        "nav.tables": "桌台",
        "nav.users": "用戶",
        "nav.analytics": "分析",
        "nav.cashier": "收銀",
        "unauthorized.title": "無權訪問",
        "unauthorized.description": "您沒有權限訪問此頁面",
        "unauthorized.permissionDenied": "權限被拒絕",
        "unauthorized.permissionMessage": "請聯繫管理員獲取權限",
        "unauthorized.currentLoginInfo": "當前登入資訊",
        "unauthorized.usernameLabel": "用戶名",
        "unauthorized.roleLabel": "角色",
        "unauthorized.restaurantLabel": "餐廳",
        "unauthorized.availableFeatures": "可用功能",
        "unauthorized.goBack": "返回上一頁",
        "unauthorized.goHome": "返回首頁",
        "unauthorized.contactAdmin": "聯繫管理員",
        "unauthorized.roles.admin": "管理員",
        "unauthorized.roles.owner": "店主",
        "unauthorized.roles.chef": "廚師",
        "unauthorized.roles.service": "送菜員",
        "unauthorized.roles.cashier": "收銀員",
        "unauthorized.roles.unknown": "未知",
        "unauthorized.permissions.cashier": "收銀功能",
        "unauthorized.permissions.orderCheckout": "訂單結帳",
        "unauthorized.permissions.paymentProcessing": "付款處理",
        "unauthorized.permissions.basicFeatures": "基本功能",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockPush = vi.fn();
const mockGo = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: mockPush,
    go: mockGo,
    currentRoute: { value: { path: "/some/path" } },
  }),
  useRoute: () => ({ fullPath: "/non-existent-page" }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "testuser", role: 4 },
    restaurantId: "r1",
    isAuthenticated: true,
  }),
}));

// Stub heroicons
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    QuestionMarkCircleIcon: stub,
    ArrowLeftIcon: stub,
    HomeIcon: stub,
    MagnifyingGlassIcon: stub,
    InformationCircleIcon: stub,
    EnvelopeIcon: stub,
    PhoneIcon: stub,
    ShieldExclamationIcon: stub,
    ExclamationTriangleIcon: stub,
  };
});

vi.mock("@heroicons/vue/24/solid", () => {
  const stub = { template: "<span />" };
  return {
    ChartBarIcon: stub,
    ShoppingBagIcon: stub,
    UserGroupIcon: stub,
    CakeIcon: stub,
    TableCellsIcon: stub,
    CalculatorIcon: stub,
  };
});

// ── Import after mocks ──────────────────────────────────────────────────────

import NotFoundView from "../NotFoundView.vue";
import UnauthorizedView from "../UnauthorizedView.vue";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("NotFoundView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders the 404 heading", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("404");
  });

  it("renders the page-not-found title", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("頁面未找到");
  });

  it("renders the description text", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("您訪問的頁面不存在");
  });

  it("shows the attempted path", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("/non-existent-page");
  });

  it("renders '返回首頁' button", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("返回首頁");
  });

  it("renders '返回上一頁' button", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("返回上一頁");
  });

  it("navigates to /dashboard when '返回首頁' is clicked", async () => {
    const wrapper = mount(NotFoundView);
    const homeBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("返回首頁"));
    expect(homeBtn).toBeTruthy();
    await homeBtn!.trigger("click");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("renders quick navigation links", () => {
    const wrapper = mount(NotFoundView);
    expect(wrapper.text()).toContain("快速導航");
  });

  it("shows navigation links appropriate to role", () => {
    const wrapper = mount(NotFoundView);
    // Role 4 (cashier) should see dashboard and cashier
    expect(wrapper.text()).toContain("儀表板");
    expect(wrapper.text()).toContain("收銀");
  });

  it("does not show broken i18n keys (no untranslated key patterns)", () => {
    const wrapper = mount(NotFoundView);
    const text = wrapper.text();
    // Ensure no notFound.* keys appear as raw text (they should be translated)
    expect(text).not.toMatch(/notFound\.\w+/);
  });
});

describe("UnauthorizedView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders the unauthorized title", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("無權訪問");
  });

  it("renders the description", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("您沒有權限訪問此頁面");
  });

  it("renders the permission denied message", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("權限被拒絕");
  });

  it("shows user information section", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("testuser");
    expect(wrapper.text()).toContain("收銀員");
  });

  it("renders '返回首頁' button", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("返回首頁");
  });

  it("navigates to /dashboard when '返回首頁' is clicked", async () => {
    const wrapper = mount(UnauthorizedView);
    const homeBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("返回首頁"));
    expect(homeBtn).toBeTruthy();
    await homeBtn!.trigger("click");
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows available permissions for user role", () => {
    const wrapper = mount(UnauthorizedView);
    // Cashier role (4) should see cashier permissions
    expect(wrapper.text()).toContain("收銀功能");
    expect(wrapper.text()).toContain("訂單結帳");
    expect(wrapper.text()).toContain("付款處理");
  });

  it("shows contact admin link", () => {
    const wrapper = mount(UnauthorizedView);
    expect(wrapper.text()).toContain("聯繫管理員");
    const mailto = wrapper.find('a[href="mailto:admin@makanmakan.com"]');
    expect(mailto.exists()).toBe(true);
  });

  it("does not show broken i18n keys", () => {
    const wrapper = mount(UnauthorizedView);
    const text = wrapper.text();
    expect(text).not.toMatch(/unauthorized\.\w+\.\w+/);
  });
});
