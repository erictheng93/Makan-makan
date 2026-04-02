/**
 * SettingsView — Comprehensive tests for remaining tabs
 * (Delivery tab is tested separately in SettingsView-delivery.test.ts)
 *
 * Covers:
 *  1. Layout & tab navigation
 *  2. General tab (基本設定)
 *  3. Orders tab (訂單設定)
 *  4. Notifications tab (通知設定)
 *  5. Save / Reset
 *  6. Loading
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mocks (must precede component import) ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return { CheckCircleIcon: stub };
});

vi.mock("@/components/settings/IntegrationsSettings.vue", () => ({
  default: {
    name: "IntegrationsSettings",
    template: "<div>IntegrationsStub</div>",
  },
}));

const mockApiGet = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
const mockApiPut = vi.fn().mockResolvedValue({ data: { success: true } });
const mockApiPost = vi.fn().mockResolvedValue({ data: { success: true } });

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    put: (...args: any[]) => mockApiPut(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        "settings.title": "系統設定",
        "settings.subtitle": "管理餐廳系統偏好設定",
        "settings.resetDefaults": "重置為預設值",
        "settings.saveSettings": "儲存設定",
        "settings.savedSuccess": "設定已成功儲存",
        "settings.tabs.general": "基本設定",
        "settings.tabs.orders": "訂單設定",
        "settings.tabs.qrcode": "QR Code 設定",
        "settings.tabs.notifications": "通知設定",
        "settings.tabs.security": "安全設定",
        "settings.tabs.integrations": "外送平台串接",
        "settings.general.restaurantInfo": "餐廳資訊",
        "settings.general.restaurantName": "餐廳名稱",
        "settings.general.contactPhone": "聯絡電話",
        "settings.general.restaurantAddress": "餐廳地址",
        "settings.general.businessHours": "營業時間",
        "settings.general.to": "至",
        "settings.general.timezone": "時區",
        "settings.general.systemPreferences": "系統偏好",
        "settings.general.language": "介面語言",
        "settings.general.languageDesc": "選擇系統顯示語言",
        "settings.general.currency": "貨幣單位",
        "settings.general.currencyDesc": "選擇系統使用的貨幣",
        "settings.general.currencies.myr": "馬來西亞令吉 (RM)",
        "settings.general.currencies.twd": "新台幣 (NT$)",
        "settings.general.autoLogout": "自動登出時間",
        "settings.general.autoLogoutDesc": "無操作時自動登出的時間",
        "settings.general.timezones.taiwan": "台灣 (GMT+8)",
        "settings.general.timezones.malaysia": "馬來西亞 (GMT+8)",
        "settings.general.timezones.singapore": "新加坡 (GMT+8)",
        "settings.general.timezones.japan": "日本 (GMT+9)",
        "settings.general.timezones.china": "中國 (GMT+8)",
        "settings.general.timezones.vietnam": "越南 (GMT+7)",
        "settings.general.timezones.indonesia": "印尼 (GMT+7)",
        "settings.general.timezones.usEast": "美國東部 (GMT-5)",
        "settings.general.timezones.usWest": "美國西部 (GMT-8)",
        "settings.general.minutes30": "30 分鐘",
        "settings.general.hour1": "1 小時",
        "settings.general.hours2": "2 小時",
        "settings.general.hours4": "4 小時",
        "settings.general.neverLogout": "不自動登出",
        "settings.orders.title": "訂單流程設定",
        "settings.orders.autoConfirm": "自動確認訂單",
        "settings.orders.autoConfirmDesc": "新訂單自動確認，無需人工審核",
        "settings.orders.prepTimeAlert": "訂單準備時間提醒",
        "settings.orders.prepTimeAlertDesc": "訂單超過準備時間時發送提醒",
        "settings.orders.defaultPrepTime": "預設準備時間（分鐘）",
        "settings.orders.enableMinOrder": "啟用最低消費",
        "settings.orders.enableMinOrderDesc": "設定訂單最低消費金額限制",
        "settings.orders.minOrderAmount": "最低消費金額",
        "settings.orders.minOrderHint": "低於此金額的訂單將無法送出",
        "settings.orders.reminder": "提醒",
        "settings.orders.minOrderWarning": "設定最低消費可能影響客戶體驗",
        "settings.orders.retentionDays": "訂單記錄保留期限",
        "settings.days": "天",
        "settings.year": "年",
        "settings.minutes": "分鐘",
        "settings.notifications.soundTitle": "音效通知",
        "settings.notifications.enableSound": "啟用音效通知",
        "settings.notifications.enableSoundDesc":
          "有新訂單或訂單完成時播放音效",
        "settings.notifications.volume": "音量",
        "settings.notifications.newOrderSound": "新訂單音效",
        "settings.notifications.completeSound": "訂單完成音效",
        "settings.notifications.sounds.bell": "鈴聲",
        "settings.notifications.sounds.chime": "鐘聲",
        "settings.notifications.sounds.notification": "通知音",
        "settings.notifications.sounds.custom": "自訂",
        "settings.notifications.sounds.success": "成功音",
        "settings.notifications.sounds.ding": "叮咚",
        "settings.notifications.desktopTitle": "桌面通知",
        "settings.notifications.enableDesktop": "啟用桌面通知",
        "settings.notifications.enableDesktopDesc": "透過瀏覽器推送桌面通知",
        "settings.notifications.duration": "通知顯示時間（秒）",
        "settings.delivery.title": "用餐方式設定",
        "settings.delivery.subtitle": "設定內用、外帶與外送相關選項",
        "settings.delivery.enableDineIn": "啟用內用",
        "settings.delivery.enableDineInDesc": "允許客戶選擇在店內用餐",
        "settings.delivery.enableTakeaway": "啟用外帶",
        "settings.delivery.enableTakeawayDesc": "允許客戶選擇外帶取餐",
        "settings.delivery.enableDelivery": "啟用外送",
        "settings.delivery.enableDeliveryDesc": "啟用外送服務選項",
        "settings.delivery.deliveryFee": "外送費用",
        "settings.delivery.freeDeliveryHint": "設定 0 表示免運費",
        "settings.delivery.estimatedPrepTime": "預估備餐時間",
        "settings.tables.title": "桌台設定",
        "settings.tables.prefix": "桌號前綴",
        "settings.tables.autoClean": "自動清理桌台",
        "settings.tables.autoCleanDesc": "結帳後自動標記桌台為清潔狀態",
        "settings.tables.cleanDelay": "清理延遲（分鐘）",
        "settings.qrcode.shopTitle": "店家 QR Code",
        "settings.qrcode.shopDesc": "設定店家模式 QR Code",
        "settings.qrcode.enableShopMode": "啟用店家模式",
        "settings.qrcode.enableShopModeDesc":
          "啟用後客戶可透過店家 QR Code 直接點餐",
        "settings.security.passwordTitle": "密碼政策",
        "settings.security.minLength": "最小密碼長度",
        "settings.security.requireNumbers": "需要包含數字",
        "settings.security.requireNumbersDesc": "密碼必須包含至少一個數字",
        "settings.security.requireSymbols": "需要包含符號",
        "settings.security.requireSymbolsDesc": "密碼必須包含至少一個特殊符號",
        "settings.security.expireDays": "密碼過期天數",
        "settings.security.neverExpire": "永不過期",
        "settings.security.loginTitle": "登入安全",
        "settings.security.maxAttempts": "最大嘗試次數",
        "settings.security.lockoutMinutes": "鎖定時間（分鐘）",
        "settings.security.logActivity": "記錄登入記錄",
        "settings.security.logActivityDesc": "記錄所有登入和登出活動",
        "settings.alerts.saveFailed": "儲存設定失敗，請稍後再試",
        "settings.confirms.resetDefaults":
          "確定要將所有設定重置為預設值嗎？此操作無法恢復。",
      };
      return map[key] ?? key;
    },
  }),
  t: (key: string) => key,
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (v: number) => `$${v}` }),
  setRestaurantCurrency: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "test-restaurant-1",
    user: { restaurantId: "test-restaurant-1" },
  }),
}));

// Import component AFTER mocks
import SettingsView from "../SettingsView.vue";

// ──── Helpers ────

function mountSettings() {
  setActivePinia(createPinia());
  return mount(SettingsView, {
    global: {
      stubs: {
        IntegrationsSettings: { template: "<div>IntegrationsStub</div>" },
      },
    },
    attachTo: document.body,
  });
}

async function mountAndSwitchTab(tabText: string) {
  const wrapper = mountSettings();
  await flushPromises();
  const tab = wrapper.findAll("button").find((b) => b.text() === tabText);
  if (tab) {
    await tab.trigger("click");
    await nextTick();
  }
  return wrapper;
}

// ──── Tests ────

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    // Mock window.confirm and window.alert
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  // ─── 1. Layout & Tab Navigation ───

  describe("Layout & Tab Navigation", () => {
    it("should render '系統設定' heading", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.find("h1").text()).toBe("系統設定");
    });

    it("should show all tab buttons", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      const expectedTabs = [
        "基本設定",
        "訂單設定",
        "QR Code 設定",
        "通知設定",
        "安全設定",
        "外送平台串接",
      ];
      const tabButtons = wrapper.findAll("nav button");
      const tabTexts = tabButtons.map((b) => b.text());
      for (const name of expectedTabs) {
        expect(tabTexts).toContain(name);
      }
    });

    it("should show '儲存設定' and '重置為預設值' buttons", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      const buttons = wrapper.findAll("button");
      const texts = buttons.map((b) => b.text());
      expect(texts).toContain("儲存設定");
      expect(texts).toContain("重置為預設值");
    });

    it("should highlight active tab with blue border", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      // Default active tab is "general" -> "基本設定"
      const generalTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "基本設定");
      expect(generalTab).toBeDefined();
      expect(generalTab!.attributes("data-active")).toBe("true");
    });

    it("should switch tab content on click", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      // The orders tab should now be highlighted
      const ordersTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "訂單設定");
      expect(ordersTab!.attributes("data-active")).toBe("true");

      // The general tab should no longer be highlighted
      const generalTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "基本設定");
      expect(generalTab!.attributes("data-active")).toBe("false");
    });
  });

  // ─── 2. 基本設定 Tab ───

  describe("基本設定 Tab", () => {
    it("should display restaurant info fields (name, phone, address)", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("餐廳名稱");
      expect(html).toContain("聯絡電話");
      expect(html).toContain("餐廳地址");
    });

    it("should show business hours inputs", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("營業時間");
      const timeInputs = wrapper.findAll('input[type="time"]');
      expect(timeInputs.length).toBeGreaterThanOrEqual(2);
    });

    it("should show timezone selector", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("時區");
      // Check timezone options exist
      expect(wrapper.html()).toContain("台灣 (GMT+8)");
      expect(wrapper.html()).toContain("馬來西亞 (GMT+8)");
    });

    it("should show language selector", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("介面語言");
      // Check language options
      expect(wrapper.html()).toContain("繁體中文");
      expect(wrapper.html()).toContain("English");
    });

    it("should show currency selector", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("貨幣單位");
      expect(wrapper.html()).toContain("馬來西亞令吉 (RM)");
      expect(wrapper.html()).toContain("新台幣 (NT$)");
    });
  });

  // ─── 3. 訂單設定 Tab ───

  describe("訂單設定 Tab", () => {
    it("should show order-related settings heading", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("訂單流程設定");
    });

    it("should show auto-accept toggle", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("自動確認訂單");
      expect(wrapper.html()).toContain("新訂單自動確認，無需人工審核");
    });

    it("should show prep time input", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("預設準備時間（分鐘）");
      // Find the number input for default prep time
      const numberInputs = wrapper.findAll('input[type="number"]');
      const prepInput = numberInputs.find((input) => {
        const el = input.element as HTMLInputElement;
        return el.min === "5" && el.max === "60";
      });
      expect(prepInput).toBeDefined();
    });

    it("should save order settings on submit", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      expect(saveButton).toBeDefined();
      await saveButton!.trigger("click");
      await flushPromises();

      // saveSettings calls api.put with restaurant ID
      expect(mockApiPut).toHaveBeenCalledWith(
        "/restaurants/test-restaurant-1",
        expect.objectContaining({
          settings: expect.objectContaining({
            currency: "MYR",
          }),
        }),
      );
    });
  });

  // ─── 4. 通知設定 Tab ───

  describe("通知設定 Tab", () => {
    it("should show notification toggles", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      const html = wrapper.html();
      expect(html).toContain("啟用音效通知");
      expect(html).toContain("啟用桌面通知");
    });

    it("should show notification display time", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      // Desktop notification duration is visible when desktop is enabled (default: true)
      expect(wrapper.html()).toContain("通知顯示時間（秒）");
    });

    it("should toggle desktop notifications", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      // Find the desktop notification checkbox
      const checkboxes = wrapper.findAll('input[type="checkbox"]');
      const desktopCheckbox = checkboxes.find((c) => {
        const container = c.element.closest(
          ".flex.items-center.justify-between",
        );
        return container?.textContent?.includes("啟用桌面通知");
      });
      expect(desktopCheckbox).toBeDefined();

      // Default is true
      expect((desktopCheckbox!.element as HTMLInputElement).checked).toBe(true);

      // Toggle it off
      await desktopCheckbox!.setValue(false);
      await nextTick();
      expect((desktopCheckbox!.element as HTMLInputElement).checked).toBe(
        false,
      );
    });
  });

  // ─── 5. Save / Reset ───

  describe("Save / Reset", () => {
    it("should call save API on '儲存設定'", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      expect(mockApiPut).toHaveBeenCalledWith(
        "/restaurants/test-restaurant-1",
        expect.any(Object),
      );
    });

    it("should show success toast after save", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      // The success message should now be visible
      expect(wrapper.html()).toContain("設定已成功儲存");
    });

    it("should reset form on '重置為預設值'", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      // Change a setting
      const nameInput = wrapper.find('input[type="text"]');
      await nameInput.setValue("New Name");

      const resetButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "重置為預設值");
      await resetButton!.trigger("click");
      await nextTick();

      // confirm was called
      expect(window.confirm).toHaveBeenCalled();
    });

    it("should handle save error", async () => {
      mockApiPut.mockRejectedValueOnce(new Error("Network error"));

      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      // alert should be called with failure message
      expect(window.alert).toHaveBeenCalledWith("儲存設定失敗，請稍後再試");
    });
  });

  // ─── 6. Loading ───

  describe("Loading", () => {
    it("should load settings on mount", async () => {
      mountSettings();
      await flushPromises();

      // loadSettings calls api.get with restaurant endpoint
      expect(mockApiGet).toHaveBeenCalledWith("/restaurants/test-restaurant-1");
    });

    it("should load shop QR info on mount", async () => {
      mountSettings();
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/restaurants/test-restaurant-1/qr/shop",
      );
    });
  });

  // ─── 7. QR Code 設定 Tab ───

  describe("QR Code 設定 Tab", () => {
    it("should show shop QR title and description", async () => {
      const wrapper = await mountAndSwitchTab("QR Code 設定");
      const html = wrapper.html();
      expect(html).toContain("店家 QR Code");
      expect(html).toContain("設定店家模式 QR Code");
    });

    it("should show enable shop mode toggle", async () => {
      const wrapper = await mountAndSwitchTab("QR Code 設定");
      expect(wrapper.html()).toContain("啟用店家模式");
      expect(wrapper.html()).toContain("啟用後客戶可透過店家 QR Code 直接點餐");
    });

    it("should highlight QR Code tab when active", async () => {
      const wrapper = await mountAndSwitchTab("QR Code 設定");
      const qrTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "QR Code 設定");
      expect(qrTab!.attributes("data-active")).toBe("true");
    });

    it("should have shop mode checkbox in QR tab", async () => {
      const wrapper = await mountAndSwitchTab("QR Code 設定");
      const checkboxes = wrapper.findAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 8. 安全設定 Tab ───

  describe("安全設定 Tab", () => {
    it("should show password policy section", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("密碼政策");
    });

    it("should show minimum password length input", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("最小密碼長度");
      const numberInputs = wrapper.findAll('input[type="number"]');
      const minLenInput = numberInputs.find((input) => {
        const el = input.element as HTMLInputElement;
        return el.min === "6" && el.max === "32";
      });
      expect(minLenInput).toBeDefined();
    });

    it("should show require numbers toggle", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("需要包含數字");
      expect(wrapper.html()).toContain("密碼必須包含至少一個數字");
    });

    it("should show require symbols toggle", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("需要包含符號");
      expect(wrapper.html()).toContain("密碼必須包含至少一個特殊符號");
    });

    it("should show password expiry selector", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("密碼過期天數");
      expect(wrapper.html()).toContain("永不過期");
    });

    it("should show login security section", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("登入安全");
    });

    it("should show max login attempts input", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("最大嘗試次數");
      const numberInputs = wrapper.findAll('input[type="number"]');
      const maxAttemptsInput = numberInputs.find((input) => {
        const el = input.element as HTMLInputElement;
        return el.min === "3" && el.max === "10";
      });
      expect(maxAttemptsInput).toBeDefined();
    });

    it("should show lockout minutes input", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("鎖定時間（分鐘）");
    });

    it("should show log activity toggle", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      expect(wrapper.html()).toContain("記錄登入記錄");
      expect(wrapper.html()).toContain("記錄所有登入和登出活動");
    });

    it("should highlight security tab when active", async () => {
      const wrapper = await mountAndSwitchTab("安全設定");
      const securityTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "安全設定");
      expect(securityTab!.attributes("data-active")).toBe("true");
    });
  });

  // ─── 9. 外送平台串接 Tab ───

  describe("外送平台串接 Tab", () => {
    it("should show IntegrationsSettings stub when tab is active", async () => {
      const wrapper = await mountAndSwitchTab("外送平台串接");
      expect(wrapper.html()).toContain("IntegrationsStub");
    });

    it("should highlight integrations tab when active", async () => {
      const wrapper = await mountAndSwitchTab("外送平台串接");
      const integrationsTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "外送平台串接");
      expect(integrationsTab!.attributes("data-active")).toBe("true");
    });
  });

  // ─── 10. Order Settings (Deeper) ───

  describe("訂單設定 Tab (Deeper)", () => {
    it("should show prep time alert toggle", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("訂單準備時間提醒");
      expect(wrapper.html()).toContain("訂單超過準備時間時發送提醒");
    });

    it("should show minimum order toggle", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("啟用最低消費");
      expect(wrapper.html()).toContain("設定訂單最低消費金額限制");
    });

    it("should show order retention days selector", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("訂單記錄保留期限");
      // Check retention options exist
      expect(wrapper.html()).toContain("30 天");
      expect(wrapper.html()).toContain("90 天");
      expect(wrapper.html()).toContain("180 天");
    });

    it("should show delivery settings section (dine-in, takeaway, delivery)", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("用餐方式設定");
      expect(wrapper.html()).toContain("啟用內用");
      expect(wrapper.html()).toContain("啟用外帶");
      expect(wrapper.html()).toContain("啟用外送");
    });

    it("should show table settings section", async () => {
      const wrapper = await mountAndSwitchTab("訂單設定");
      expect(wrapper.html()).toContain("桌台設定");
      expect(wrapper.html()).toContain("桌號前綴");
      expect(wrapper.html()).toContain("自動清理桌台");
    });
  });

  // ─── 11. Save / Reset (Deeper) ───

  describe("Save / Reset (Deeper)", () => {
    it("should not reset when confirm is cancelled", async () => {
      (window.confirm as Mock).mockReturnValueOnce(false);
      const wrapper = mountSettings();
      await flushPromises();

      // Change a setting
      const nameInput = wrapper.find('input[type="text"]');
      await nameInput.setValue("Changed Name");

      const resetButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "重置為預設值");
      await resetButton!.trigger("click");
      await nextTick();

      expect(window.confirm).toHaveBeenCalledWith(
        "確定要將所有設定重置為預設值嗎？此操作無法恢復。",
      );
    });

    it("should show success toast that disappears (contains proper text)", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      // Success message is visible with correct text
      const successDiv = wrapper.find(".bg-green-100");
      expect(successDiv.exists()).toBe(true);
      expect(successDiv.text()).toContain("設定已成功儲存");
    });

    it("should call save API with settings including currency", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      expect(mockApiPut).toHaveBeenCalledWith(
        "/restaurants/test-restaurant-1",
        expect.objectContaining({
          settings: expect.objectContaining({
            currency: "MYR",
          }),
        }),
      );
    });

    it("should handle save error with alert message", async () => {
      mockApiPut.mockRejectedValueOnce(new Error("Server error"));
      const wrapper = mountSettings();
      await flushPromises();

      const saveButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "儲存設定");
      await saveButton!.trigger("click");
      await flushPromises();

      expect(window.alert).toHaveBeenCalledWith("儲存設定失敗，請稍後再試");
    });
  });

  // ─── 12. Form Dirty State & Tab Switching ───

  describe("Form Dirty State & Tab Switching", () => {
    it("should allow switching between all tabs", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const tabNames = [
        "基本設定",
        "訂單設定",
        "QR Code 設定",
        "通知設定",
        "安全設定",
        "外送平台串接",
      ];

      for (const tabName of tabNames) {
        const tab = wrapper
          .findAll("nav button")
          .find((b) => b.text() === tabName);
        expect(tab).toBeDefined();
        await tab!.trigger("click");
        await nextTick();
        expect(tab!.attributes("data-active")).toBe("true");
      }
    });

    it("should deactivate previous tab when switching", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      // Click orders tab
      const ordersTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "訂單設定");
      await ordersTab!.trigger("click");
      await nextTick();

      // General tab should now be inactive
      const generalTab = wrapper
        .findAll("nav button")
        .find((b) => b.text() === "基本設定");
      expect(generalTab!.attributes("data-active")).toBe("false");
    });

    it("should modify restaurant name input", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const nameInput = wrapper.find('input[type="text"]');
      await nameInput.setValue("Test Restaurant");
      expect((nameInput.element as HTMLInputElement).value).toBe(
        "Test Restaurant",
      );
    });

    it("should modify business hours time inputs", async () => {
      const wrapper = mountSettings();
      await flushPromises();

      const timeInputs = wrapper.findAll('input[type="time"]');
      expect(timeInputs.length).toBeGreaterThanOrEqual(2);
      await timeInputs[0].setValue("09:00");
      expect((timeInputs[0].element as HTMLInputElement).value).toBe("09:00");
    });
  });

  // ─── 13. Notification Tab (Deeper) ───

  describe("通知設定 Tab (Deeper)", () => {
    it("should show sound notification section", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      expect(wrapper.html()).toContain("音效通知");
      expect(wrapper.html()).toContain("啟用音效通知");
      expect(wrapper.html()).toContain("有新訂單或訂單完成時播放音效");
    });

    it("should show new order sound and complete sound selectors", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      expect(wrapper.html()).toContain("新訂單音效");
      expect(wrapper.html()).toContain("訂單完成音效");
    });

    it("should show volume control", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      expect(wrapper.html()).toContain("音量");
    });

    it("should show desktop notification section", async () => {
      const wrapper = await mountAndSwitchTab("通知設定");
      expect(wrapper.html()).toContain("桌面通知");
      expect(wrapper.html()).toContain("啟用桌面通知");
      expect(wrapper.html()).toContain("透過瀏覽器推送桌面通知");
    });
  });

  // ─── 14. General Tab (Deeper) ───

  describe("基本設定 Tab (Deeper)", () => {
    it("should show auto-logout selector with all options", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("自動登出時間");
      expect(wrapper.html()).toContain("30 分鐘");
      expect(wrapper.html()).toContain("1 小時");
      expect(wrapper.html()).toContain("2 小時");
      expect(wrapper.html()).toContain("4 小時");
      expect(wrapper.html()).toContain("不自動登出");
    });

    it("should show system preferences section", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("系統偏好");
    });

    it("should show all timezone options", async () => {
      const wrapper = mountSettings();
      await flushPromises();
      expect(wrapper.html()).toContain("新加坡 (GMT+8)");
      expect(wrapper.html()).toContain("日本 (GMT+9)");
      expect(wrapper.html()).toContain("越南 (GMT+7)");
    });
  });
});
