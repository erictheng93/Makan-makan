import { test, expect, type Page } from "@playwright/test";
import {
  PERSONAS,
  RESTAURANT,
  MENU_ITEMS,
  MENU_CATEGORIES,
  createMockOrder,
} from "../helpers/personas";
import { mockAllAPIs } from "../helpers/mock-api";
import { loginAs, expectNavigatedTo } from "../helpers/assertions";

/**
 * Admin Dashboard - 篩選與搜尋功能 E2E 測試
 *
 * 測試覆蓋範圍：
 * - 訂單篩選（狀態、類型、來源、搜尋）
 * - 菜單搜尋與分類篩選
 * - 優惠券篩選（伺服器端）
 * - 員工篩選（角色、狀態、搜尋）
 */

const API = "**/api/v1";

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// -----------------------------------------------------------------------
// 共用的模擬訂單資料
// -----------------------------------------------------------------------

const mockOrders = [
  createMockOrder({
    id: "o1",
    orderNumber: "ORD-20260330-001",
    status: 0, // pending
    customerName: "張先生",
    tableId: "table-1",
    tableName: "A-1",
  }),
  createMockOrder({
    id: "o2",
    orderNumber: "ORD-20260330-002",
    status: 2, // preparing
    customerName: "李小姐",
    tableId: "table-2",
    tableName: "A-2",
  }),
  createMockOrder({
    id: "o3",
    orderNumber: "ORD-20260330-003",
    status: 6, // completed
    customerName: "王大明",
    tableId: null,
    tableName: null,
  }),
  createMockOrder({
    id: "o4",
    orderNumber: "ORD-20260330-004",
    status: 7, // cancelled
    customerName: "陳美玲",
    tableId: "table-3",
    tableName: "B-1",
    orderSource: "uber_eats",
  }),
];

// -----------------------------------------------------------------------
// 共用的模擬員工資料
// -----------------------------------------------------------------------

const mockEmployees = [
  {
    id: 201,
    username: "chef-wang",
    fullName: "王大廚",
    email: "chef-wang@test.com",
    role: 2,
    status: "active",
    restaurantId: RESTAURANT.id,
    lastLogin: new Date().toISOString(),
  },
  {
    id: 202,
    username: "chef-lin",
    fullName: "林師傅",
    email: "chef-lin@test.com",
    role: 2,
    status: "active",
    restaurantId: RESTAURANT.id,
    lastLogin: new Date().toISOString(),
  },
  {
    id: 301,
    username: "service-chen",
    fullName: "陳小美",
    email: "service-chen@test.com",
    role: 3,
    status: "active",
    restaurantId: RESTAURANT.id,
    lastLogin: new Date().toISOString(),
  },
  {
    id: 401,
    username: "cashier-huang",
    fullName: "黃小花",
    email: "cashier-huang@test.com",
    role: 4,
    status: "inactive",
    restaurantId: RESTAURANT.id,
    lastLogin: null,
  },
];

// -----------------------------------------------------------------------
// 共用的模擬優惠券資料
// -----------------------------------------------------------------------

const mockCoupons = [
  {
    id: "coupon-1",
    code: "SAVE10",
    name: "九折優惠",
    discountType: "percentage",
    discountValue: 10,
    status: "active",
    usageCount: 5,
    usageLimit: 100,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T23:59:59Z",
    restaurantId: RESTAURANT.id,
  },
  {
    id: "coupon-2",
    code: "FLAT50",
    name: "滿百折50",
    discountType: "fixed",
    discountValue: 5000,
    status: "active",
    usageCount: 20,
    usageLimit: 50,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-06-30T23:59:59Z",
    restaurantId: RESTAURANT.id,
  },
  {
    id: "coupon-3",
    code: "EXPIRED20",
    name: "已過期優惠",
    discountType: "percentage",
    discountValue: 20,
    status: "expired",
    usageCount: 30,
    usageLimit: 30,
    startDate: "2025-01-01T00:00:00Z",
    endDate: "2025-12-31T23:59:59Z",
    restaurantId: RESTAURANT.id,
  },
];

// -----------------------------------------------------------------------
// 共用的登入和設定函式
// -----------------------------------------------------------------------

async function setupAndLogin(page: Page) {
  await mockAllAPIs(page, PERSONAS.OWNER);
  await page.goto("/login");
  await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
}

// =======================================================================
// 訂單篩選與搜尋
// =======================================================================

test.describe("訂單管理 - 篩選與搜尋 (/dashboard/orders)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);

    // 覆寫訂單 API，回傳多筆不同狀態的訂單
    await page.route(`${API}/orders`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(
          json({
            success: true,
            data: mockOrders,
            pagination: {
              page: 1,
              limit: 20,
              total: mockOrders.length,
              totalPages: 1,
            },
          }),
        );
      } else {
        route.continue();
      }
    });

    await page.goto("/login");
    await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
  });

  test("狀態篩選 - 選擇 pending 只顯示待處理訂單", async ({ page }) => {
    // 確認初始狀態有多筆訂單
    const ordersList = page.locator(".orders-view");
    await expect(ordersList).toBeVisible();

    // 選擇 pending 狀態
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="pending"]') })
      .first();
    await statusSelect.selectOption("pending");

    // 等待篩選結果更新
    await page.waitForTimeout(300);

    // 驗證只顯示待處理訂單（包含 ORD-20260330-001）
    await expect(page.getByText("ORD-20260330-001")).toBeVisible();
    // 其他狀態的訂單不應顯示
    await expect(page.getByText("ORD-20260330-003")).toBeHidden();
    await expect(page.getByText("ORD-20260330-004")).toBeHidden();
  });

  test("狀態篩選 - 選擇 preparing 只顯示準備中訂單", async ({ page }) => {
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="preparing"]') })
      .first();
    await statusSelect.selectOption("preparing");

    await page.waitForTimeout(300);

    // 驗證只顯示準備中的訂單
    await expect(page.getByText("ORD-20260330-002")).toBeVisible();
    await expect(page.getByText("ORD-20260330-001")).toBeHidden();
    await expect(page.getByText("ORD-20260330-003")).toBeHidden();
  });

  test("狀態篩選 - 選回全部恢復顯示所有訂單", async ({ page }) => {
    // 先篩選 pending
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="pending"]') })
      .first();
    await statusSelect.selectOption("pending");
    await page.waitForTimeout(300);

    // 切回全部
    await statusSelect.selectOption("");
    await page.waitForTimeout(300);

    // 所有訂單都應該顯示
    await expect(page.getByText("ORD-20260330-001")).toBeVisible();
    await expect(page.getByText("ORD-20260330-002")).toBeVisible();
    await expect(page.getByText("ORD-20260330-003")).toBeVisible();
    await expect(page.getByText("ORD-20260330-004")).toBeVisible();
  });

  test("搜尋訂單編號 - 輸入訂單號碼篩選", async ({ page }) => {
    const searchInput = page.locator('.orders-view input[type="text"]').first();
    await searchInput.fill("ORD-20260330-003");

    await page.waitForTimeout(300);

    // 只有匹配的訂單應該顯示
    await expect(page.getByText("ORD-20260330-003")).toBeVisible();
    await expect(page.getByText("ORD-20260330-001")).toBeHidden();
    await expect(page.getByText("ORD-20260330-002")).toBeHidden();
  });

  test("搜尋客戶姓名 - 輸入姓名篩選", async ({ page }) => {
    const searchInput = page.locator('.orders-view input[type="text"]').first();
    await searchInput.fill("李小姐");

    await page.waitForTimeout(300);

    // 只有匹配客戶名的訂單應該顯示
    await expect(page.getByText("ORD-20260330-002")).toBeVisible();
    await expect(page.getByText("ORD-20260330-001")).toBeHidden();
  });

  test("組合篩選 - 狀態 + 類型同時篩選", async ({ page }) => {
    // 選擇 pending 狀態
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="pending"]') })
      .first();
    await statusSelect.selectOption("pending");

    // 選擇 dine_in 類型（有 tableId 的就是 dine_in）
    const typeSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="dine_in"]') })
      .first();
    await typeSelect.selectOption("dine_in");

    await page.waitForTimeout(300);

    // o1 是 pending + 有 tableId = dine_in，應該顯示
    await expect(page.getByText("ORD-20260330-001")).toBeVisible();
    // o3 是 completed + 無 tableId = takeaway，不應顯示
    await expect(page.getByText("ORD-20260330-003")).toBeHidden();
  });

  test("來源篩選 - 選擇 uber_eats 只顯示 Uber Eats 訂單", async ({ page }) => {
    const sourceSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="uber_eats"]') })
      .first();
    await sourceSelect.selectOption("uber_eats");

    await page.waitForTimeout(300);

    // 只有 o4 設定了 orderSource: uber_eats
    await expect(page.getByText("ORD-20260330-004")).toBeVisible();
    await expect(page.getByText("ORD-20260330-001")).toBeHidden();
  });
});

// =======================================================================
// 菜單篩選與搜尋
// =======================================================================

test.describe("菜單管理 - 篩選與搜尋 (/dashboard/menu)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);
    await page.goto("/login");
    await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
  });

  test("搜尋菜品 - 輸入菜名篩選", async ({ page }) => {
    // 在 menu-view 中找到搜尋輸入框
    const searchInput = page.locator('.menu-view input[type="text"]').first();
    await searchInput.fill("牛肉麵");

    await page.waitForTimeout(300);

    // 應該顯示牛肉麵
    await expect(page.getByText("牛肉麵").first()).toBeVisible();
    // 其他菜品不應顯示
    await expect(page.getByText("排骨飯")).toBeHidden();
    await expect(page.getByText("珍珠奶茶")).toBeHidden();
  });

  test("搜尋菜品 - 清空搜尋恢復所有菜品", async ({ page }) => {
    const searchInput = page.locator('.menu-view input[type="text"]').first();

    // 先搜尋
    await searchInput.fill("牛肉麵");
    await page.waitForTimeout(300);

    // 清空搜尋框
    await searchInput.fill("");
    await page.waitForTimeout(300);

    // 所有菜品應該恢復顯示
    await expect(page.getByText("牛肉麵").first()).toBeVisible();
    await expect(page.getByText("排骨飯").first()).toBeVisible();
  });

  test("分類篩選 - 點擊不同分類只顯示該分類菜品", async ({ page }) => {
    // MENU_CATEGORIES: 麵食(cat-1), 飯類(cat-2), 飲料(cat-3)
    // 點擊「飲料」分類
    const categoryPanel = page.locator(".menu-view");
    const drinkCategory = categoryPanel.getByText("飲料");
    await drinkCategory.click();

    await page.waitForTimeout(300);

    // 飲料分類下只有珍珠奶茶
    await expect(page.getByText("珍珠奶茶").first()).toBeVisible();
    // 麵食和飯類不應顯示
    await expect(page.getByText("排骨飯")).toBeHidden();
  });

  test("分類篩選 - 點擊麵食分類顯示麵食類菜品", async ({ page }) => {
    const noodleCategory = page.locator(".menu-view").getByText("麵食");
    await noodleCategory.click();

    await page.waitForTimeout(300);

    // 麵食分類有牛肉麵和水餃
    await expect(page.getByText("牛肉麵").first()).toBeVisible();
    await expect(page.getByText("水餃").first()).toBeVisible();
    // 飯類和飲料不應顯示
    await expect(page.getByText("排骨飯")).toBeHidden();
  });

  test("狀態篩選標籤 - 點擊篩選標籤切換顯示", async ({ page }) => {
    // 找到狀態篩選標籤容器（圓角分段控制器）
    const filterPills = page.locator(
      ".menu-view .bg-\\[\\#F2F2F7\\].rounded-full.p-0\\.5",
    );

    // 先確認篩選標籤區域可見
    if (await filterPills.isVisible()) {
      // 點擊篩選標籤中的按鈕（通常有 "全部"、"上架"、"下架" 之類的選項）
      const buttons = filterPills.locator("button");
      const buttonCount = await buttons.count();

      if (buttonCount >= 2) {
        // 點擊第二個標籤（通常是「上架中」或「可用」）
        await buttons.nth(1).click();
        await page.waitForTimeout(300);

        // 水餃是 available: false，不應顯示
        await expect(page.getByText("水餃")).toBeHidden();
        // 牛肉麵是 available: true，應該顯示
        await expect(page.getByText("牛肉麵").first()).toBeVisible();
      }

      if (buttonCount >= 3) {
        // 點擊第三個標籤（通常是「已下架」或「不可用」）
        await buttons.nth(2).click();
        await page.waitForTimeout(300);

        // 水餃是 available: false，應該顯示
        await expect(page.getByText("水餃").first()).toBeVisible();
      }
    }
  });
});

// =======================================================================
// 優惠券篩選與搜尋（伺服器端篩選）
// =======================================================================

test.describe("優惠券管理 - 篩選與搜尋 (/dashboard/coupons)", () => {
  let couponApiCalls: { url: string; params: URLSearchParams }[];

  test.beforeEach(async ({ page }) => {
    couponApiCalls = [];
    await mockAllAPIs(page, PERSONAS.OWNER);

    // 模擬優惠券 API，根據查詢參數回傳不同結果
    await page.route(new RegExp(`${API}/coupons`), (route) => {
      const url = route.request().url();
      const params = new URL(url).searchParams;
      couponApiCalls.push({ url, params });

      // 根據 status 參數篩選
      let filtered = [...mockCoupons];
      const statusParam = params.get("status");
      if (statusParam) {
        filtered = filtered.filter((c) => c.status === statusParam);
      }
      const searchParam = params.get("search");
      if (searchParam) {
        filtered = filtered.filter(
          (c) =>
            c.code.toLowerCase().includes(searchParam.toLowerCase()) ||
            c.name.toLowerCase().includes(searchParam.toLowerCase()),
        );
      }
      const discountTypeParam = params.get("discountType");
      if (discountTypeParam) {
        filtered = filtered.filter((c) => c.discountType === discountTypeParam);
      }

      route.fulfill(
        json({
          success: true,
          data: filtered,
          pagination: {
            page: 1,
            limit: 20,
            total: filtered.length,
            totalPages: 1,
          },
          stats: {
            total: mockCoupons.length,
            active: mockCoupons.filter((c) => c.status === "active").length,
            totalUsed: mockCoupons.reduce((sum, c) => sum + c.usageCount, 0),
            totalSavings: 150000,
          },
        }),
      );
    });

    await page.goto("/login");
    await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
    await page.goto("/dashboard/coupons");
    await page.waitForLoadState("networkidle");
  });

  test("搜尋優惠券 - 輸入搜尋文字並等待防抖", async ({ page }) => {
    const searchInput = page
      .locator('.coupons-view input[type="text"]')
      .first();
    await searchInput.fill("SAVE");

    // 等待防抖 300ms + 網路請求
    await page.waitForTimeout(500);

    // 驗證 API 被呼叫時帶有 search 參數
    const searchCall = couponApiCalls.find(
      (c) => c.params.get("search") === "SAVE",
    );
    expect(searchCall).toBeTruthy();
  });

  test("狀態篩選 - 選擇 active 觸發伺服器端篩選", async ({ page }) => {
    // 清除之前的 API 呼叫紀錄
    couponApiCalls = [];

    const statusSelect = page
      .locator(".coupons-view select")
      .filter({ has: page.locator('option[value="active"]') })
      .first();
    await statusSelect.selectOption("active");

    await page.waitForTimeout(500);

    // 驗證 API 被呼叫時帶有 status=active 參數
    const statusCall = couponApiCalls.find(
      (c) => c.params.get("status") === "active",
    );
    expect(statusCall).toBeTruthy();
  });

  test("狀態篩選 - 選擇 expired 只顯示過期優惠券", async ({ page }) => {
    couponApiCalls = [];

    const statusSelect = page
      .locator(".coupons-view select")
      .filter({ has: page.locator('option[value="expired"]') })
      .first();
    await statusSelect.selectOption("expired");

    await page.waitForTimeout(500);

    // 驗證 API 被呼叫時帶有 status=expired
    const expiredCall = couponApiCalls.find(
      (c) => c.params.get("status") === "expired",
    );
    expect(expiredCall).toBeTruthy();

    // 只有過期的優惠券應該顯示在頁面上
    await expect(page.getByText("EXPIRED20")).toBeVisible();
    await expect(page.getByText("SAVE10")).toBeHidden();
  });

  test("折扣類型篩選 - 選擇 percentage 觸發篩選", async ({ page }) => {
    couponApiCalls = [];

    const typeSelect = page
      .locator(".coupons-view select")
      .filter({ has: page.locator('option[value="percentage"]') })
      .first();
    await typeSelect.selectOption("percentage");

    await page.waitForTimeout(500);

    // 驗證 API 被呼叫時帶有 discountType=percentage
    const typeCall = couponApiCalls.find(
      (c) => c.params.get("discountType") === "percentage",
    );
    expect(typeCall).toBeTruthy();
  });

  test("重置篩選 - 點擊重置按鈕清除所有條件", async ({ page }) => {
    // 先設定一些篩選條件
    const statusSelect = page
      .locator(".coupons-view select")
      .filter({ has: page.locator('option[value="active"]') })
      .first();
    await statusSelect.selectOption("active");
    await page.waitForTimeout(500);

    const searchInput = page
      .locator('.coupons-view input[type="text"]')
      .first();
    await searchInput.fill("SAVE");
    await page.waitForTimeout(500);

    // 清除紀錄以追蹤重置後的呼叫
    couponApiCalls = [];

    // 點擊重置按鈕
    const resetButton = page
      .locator(".coupons-view button")
      .filter({ hasText: /reset|重置|清除/i })
      .first();
    await resetButton.click();

    await page.waitForTimeout(500);

    // 驗證篩選條件被清除
    await expect(searchInput).toHaveValue("");
    await expect(statusSelect).toHaveValue("");

    // 驗證 API 被重新呼叫（不帶篩選參數或帶空參數）
    expect(couponApiCalls.length).toBeGreaterThan(0);
  });
});

// =======================================================================
// 員工篩選與搜尋
// =======================================================================

test.describe("員工管理 - 篩選與搜尋 (/dashboard/employees)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);

    // 模擬員工列表 API
    await page.route(new RegExp(`${API}/users/${RESTAURANT.id}`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(
          json({
            success: true,
            data: mockEmployees,
          }),
        );
      } else {
        route.continue();
      }
    });

    await page.goto("/login");
    await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
    await page.goto("/dashboard/employees");
    await page.waitForLoadState("networkidle");
  });

  test("角色篩選 - 選擇廚師只顯示廚師員工", async ({ page }) => {
    // 找到角色篩選下拉選單（包含 option value="2" 的 select）
    const roleSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="2"]') })
      .first();
    await roleSelect.selectOption("2");

    await page.waitForTimeout(300);

    // 應該顯示兩位廚師
    await expect(page.getByText("王大廚").first()).toBeVisible();
    await expect(page.getByText("林師傅").first()).toBeVisible();
    // 送菜員和收銀員不應顯示
    await expect(page.getByText("陳小美")).toBeHidden();
    await expect(page.getByText("黃小花")).toBeHidden();
  });

  test("角色篩選 - 選擇送菜員只顯示送菜員", async ({ page }) => {
    const roleSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="3"]') })
      .first();
    await roleSelect.selectOption("3");

    await page.waitForTimeout(300);

    await expect(page.getByText("陳小美").first()).toBeVisible();
    await expect(page.getByText("王大廚")).toBeHidden();
    await expect(page.getByText("黃小花")).toBeHidden();
  });

  test("角色篩選 - 選回全部恢復所有員工", async ({ page }) => {
    const roleSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="2"]') })
      .first();
    // 先篩選
    await roleSelect.selectOption("2");
    await page.waitForTimeout(300);

    // 選回全部
    await roleSelect.selectOption("");
    await page.waitForTimeout(300);

    // 所有員工都應顯示
    await expect(page.getByText("王大廚").first()).toBeVisible();
    await expect(page.getByText("陳小美").first()).toBeVisible();
    await expect(page.getByText("黃小花").first()).toBeVisible();
  });

  test("搜尋員工姓名 - 輸入姓名篩選", async ({ page }) => {
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill("王大廚");

    await page.waitForTimeout(300);

    // 只有匹配的員工應該顯示
    await expect(page.getByText("王大廚").first()).toBeVisible();
    await expect(page.getByText("林師傅")).toBeHidden();
    await expect(page.getByText("陳小美")).toBeHidden();
  });

  test("狀態篩選 - 選擇 inactive 只顯示停用員工", async ({ page }) => {
    // 找到狀態篩選下拉（包含 option value="inactive"）
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="inactive"]') })
      .first();
    await statusSelect.selectOption("inactive");

    await page.waitForTimeout(300);

    // 只有 inactive 的員工應該顯示
    await expect(page.getByText("黃小花").first()).toBeVisible();
    await expect(page.getByText("王大廚")).toBeHidden();
    await expect(page.getByText("陳小美")).toBeHidden();
  });

  test("組合篩選 - 角色 + 狀態同時篩選", async ({ page }) => {
    // 選擇廚師角色
    const roleSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="2"]') })
      .first();
    await roleSelect.selectOption("2");

    // 選擇 active 狀態
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="active"]') })
      .first();
    await statusSelect.selectOption("active");

    await page.waitForTimeout(300);

    // 只有 active 的廚師應該顯示
    await expect(page.getByText("王大廚").first()).toBeVisible();
    await expect(page.getByText("林師傅").first()).toBeVisible();
    // inactive 的收銀員不應顯示
    await expect(page.getByText("黃小花")).toBeHidden();
  });

  test("搜尋 + 角色組合 - 搜尋文字配合角色篩選", async ({ page }) => {
    // 先選擇廚師
    const roleSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="2"]') })
      .first();
    await roleSelect.selectOption("2");

    // 再搜尋特定名字
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill("林");

    await page.waitForTimeout(300);

    // 只有林師傅應該顯示
    await expect(page.getByText("林師傅").first()).toBeVisible();
    await expect(page.getByText("王大廚")).toBeHidden();
  });
});
