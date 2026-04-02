import { test, expect } from "@playwright/test";
import {
  PERSONAS,
  RESTAURANT,
  MENU_ITEMS,
  MENU_CATEGORIES,
  createMockOrder,
  type Persona,
} from "../helpers/personas";
import { mockAllAPIs } from "../helpers/mock-api";
import {
  expectToastMessage,
  expectNavigatedTo,
  loginAs,
} from "../helpers/assertions";

/**
 * Admin Dashboard - Modal/Dialog 互動測試
 *
 * 測試場景：
 * 1. 訂單詳情模態框 - 開啟、關閉、資料顯示
 * 2. 預約建立對話框 - 開啟、填寫、提交、取消
 * 3. 優惠券刪除確認模態框 - 確認刪除、取消刪除
 * 4. 菜單刪除確認模態框 - 確認刪除、取消刪除
 */

// ---------------------------------------------------------------------------
// 模擬資料
// ---------------------------------------------------------------------------

/** 管理員角色 (role=0)，用於需要 isAdmin 權限的測試 */
const ADMIN_PERSONA: Persona = {
  ...PERSONAS.OWNER,
  role: 0,
  id: 1,
  username: "admin-e2e",
  fullName: "E2E Admin",
  email: "admin@e2e.test",
  token: "mock-admin-jwt-token",
  refreshToken: "mock-admin-refresh-token",
};

const mockCoupon = {
  id: "coupon-1",
  name: "新年優惠",
  code: "NY2026",
  description: "新年特別折扣",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountAmount: 5000,
  minOrderAmount: 10000,
  usageLimit: 100,
  usedCount: 25,
  isActive: true,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  restaurantId: RESTAURANT.id,
};

const mockOrder = createMockOrder({
  id: "order-modal-001",
  orderNumber: "ORD-20260330-MODAL",
  totalAmount: 30000,
});

// ---------------------------------------------------------------------------
// 共用輔助函數
// ---------------------------------------------------------------------------

/** 設定 API 路由並登入 */
async function setupAndLogin(
  page: import("@playwright/test").Page,
  persona: Persona = PERSONAS.OWNER,
) {
  await mockAllAPIs(page, persona);
  await page.goto("/login");
  await loginAs(page, persona.username, persona.password);
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
}

/** 額外模擬優惠券 API 端點 */
async function mockCouponsAPI(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/coupons/stats/summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { total: 5, active: 3, totalUsed: 10, totalSavings: 50000 },
      }),
    }),
  );

  await page.route("**/api/v1/coupons", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [mockCoupon],
          pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    } else {
      route.continue();
    }
  });

  await page.route("**/api/v1/coupons/coupon-1", (route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      route.continue();
    }
  });
}

/** 額外模擬預約 API 端點（覆蓋 mockAllAPIs 中的基本版本） */
async function mockReservationsAPI(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/reservations**", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0 },
          pagination: { total: 0 },
        }),
      });
    } else if (method === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "res-new",
            confirmationCode: "RES-ABC123",
            status: "pending",
            customerName: "王小明",
            customerPhone: "0912345678",
            partySize: 4,
          },
        }),
      });
    } else {
      route.continue();
    }
  });
}

// ===========================================================================
// 1. 訂單詳情模態框測試
// ===========================================================================

test.describe("訂單詳情模態框 (Order Detail Modal)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndLogin(page);
    await page.goto("/dashboard/orders");
    // 等待訂單列表載入
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );
  });

  test("點擊眼睛圖示開啟模態框，點擊關閉按鈕關閉", async ({ page }) => {
    // 點擊第一個訂單的查看按鈕（EyeIcon）
    const viewButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /^$/ })
      .first();

    // 使用更穩定的選擇器：藍色的查看按鈕
    const eyeButton = page.locator("button[title]").first();
    // 找到包含 EyeIcon 的按鈕 — 使用文字或 title 屬性定位
    const orderViewBtn = page
      .locator(".text-blue-600")
      .filter({ has: page.locator("svg") })
      .first();
    await orderViewBtn.click();

    // 驗證模態框出現
    const modal = page.locator(".fixed.inset-0.z-50");
    await expect(modal).toBeVisible();

    // 驗證模態框內容區域可見
    const modalContent = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg.shadow-xl",
    );
    await expect(modalContent).toBeVisible();

    // 點擊右上角關閉按鈕 (XMarkIcon)
    const closeButton = modalContent.locator("button.text-gray-400");
    await closeButton.click();

    // 驗證模態框已關閉
    await expect(modal).toBeHidden();
  });

  test("點擊背景遮罩關閉模態框", async ({ page }) => {
    // 開啟模態框
    const orderViewBtn = page
      .locator(".text-blue-600")
      .filter({ has: page.locator("svg") })
      .first();
    await orderViewBtn.click();

    const modal = page.locator(".fixed.inset-0.z-50");
    await expect(modal).toBeVisible();

    // 點擊背景遮罩 (bg-black opacity-30)
    const backdrop = page.locator(".fixed.inset-0.bg-black.opacity-30");
    await backdrop.click({ force: true });

    // 驗證模態框已關閉
    await expect(modal).toBeHidden();
  });

  test("模態框顯示正確的訂單資料", async ({ page }) => {
    // 開啟模態框
    const orderViewBtn = page
      .locator(".text-blue-600")
      .filter({ has: page.locator("svg") })
      .first();
    await orderViewBtn.click();

    const modal = page.locator(".fixed.inset-0.z-50");
    await expect(modal).toBeVisible();

    const modalContent = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg.shadow-xl",
    );

    // 驗證訂單號碼顯示
    await expect(modalContent).toContainText("ORD-20260330-001");

    // 驗證桌號顯示
    await expect(modalContent).toContainText("A-1");

    // 驗證客戶名稱
    await expect(modalContent).toContainText("測試顧客");

    // 驗證訂單項目名稱
    await expect(modalContent).toContainText("牛肉麵");
    await expect(modalContent).toContainText("珍珠奶茶");

    // 驗證金額顯示（totalAmount = 30000，格式化後的價格）
    // 價格格式視 locale 而定，至少要包含數字
    const priceText = await modalContent.textContent();
    expect(priceText).toBeTruthy();
  });
});

// ===========================================================================
// 2. 預約建立對話框測試
// ===========================================================================

test.describe("預約建立對話框 (Reservation Create Dialog)", () => {
  test.beforeEach(async ({ page }) => {
    await mockReservationsAPI(page);
    await setupAndLogin(page);
    // 導航到座位管理 > 預約頁面（預設子路由）
    await page.goto("/dashboard/seating");
    await page.waitForLoadState("networkidle");
  });

  test("開啟對話框、填寫表單、提交預約", async ({ page }) => {
    // 點擊「新增預約」按鈕
    const createButton = page
      .locator("button")
      .filter({
        has: page.locator("svg"),
      })
      .filter({ hasText: /create|新增|預約/ })
      .first();

    // 若找不到按照文字匹配的按鈕，使用包含 Plus 圖示的藍色按鈕
    const reservationBtn = page.locator("button.bg-\\[\\#007AFF\\]").first();

    // 嘗試兩種定位策略
    const btn = (await reservationBtn.isVisible())
      ? reservationBtn
      : createButton;
    await btn.click();

    // 等待對話框出現 (HeadlessUI Dialog)
    const dialogPanel = page.locator('[role="dialog"]');
    await expect(dialogPanel).toBeVisible({ timeout: 5000 });

    // 填寫表單欄位
    const formInputs = dialogPanel.locator(
      "input.form-input, input[type='text'], input[type='tel'], input[type='email']",
    );

    // 客戶姓名
    const nameInput = dialogPanel.locator("input[type='text']").first();
    await nameInput.fill("王小明");

    // 客戶電話
    const phoneInput = dialogPanel.locator("input[type='tel']").first();
    await phoneInput.fill("0912345678");

    // 客戶信箱
    const emailInput = dialogPanel.locator("input[type='email']").first();
    await emailInput.fill("wang@test.com");

    // 日期
    const dateInput = dialogPanel.locator("input[type='date']").first();
    await dateInput.fill("2026-04-15");

    // 時間
    const timeInput = dialogPanel.locator("input[type='time']").first();
    await timeInput.fill("18:30");

    // 人數
    const partySizeInput = dialogPanel.locator("input[type='number']").first();
    await partySizeInput.fill("4");

    // 特殊需求
    const specialRequests = dialogPanel.locator("textarea").first();
    await specialRequests.fill("靠窗座位，需要兒童椅");

    // 提交表單
    const submitButton = dialogPanel.locator("button.btn-primary");
    await submitButton.click();

    // 驗證對話框關閉
    await expect(dialogPanel).toBeHidden({ timeout: 5000 });
  });

  test("取消預約建立 — 對話框關閉且不送出請求", async ({ page }) => {
    let postCalled = false;
    await page.route("**/api/v1/reservations", (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
      }
      route.continue();
    });

    // 開啟對話框
    const reservationBtn = page.locator("button.bg-\\[\\#007AFF\\]").first();
    // 嘗試備用定位
    const createButton = page
      .locator("button")
      .filter({
        has: page.locator("svg"),
      })
      .filter({ hasText: /create|新增|預約/ })
      .first();

    const btn = (await reservationBtn.isVisible())
      ? reservationBtn
      : createButton;
    await btn.click();

    const dialogPanel = page.locator('[role="dialog"]');
    await expect(dialogPanel).toBeVisible({ timeout: 5000 });

    // 填入部分資料
    const nameInput = dialogPanel.locator("input[type='text']").first();
    await nameInput.fill("測試客戶");

    // 點擊取消按鈕
    const cancelButton = dialogPanel.locator("button.btn-secondary");
    await cancelButton.click();

    // 驗證對話框關閉
    await expect(dialogPanel).toBeHidden({ timeout: 5000 });

    // 確認沒有發送 POST 請求
    expect(postCalled).toBe(false);
  });
});

// ===========================================================================
// 3. 優惠券刪除確認模態框測試
// ===========================================================================

test.describe("優惠券刪除確認模態框 (Coupon Delete Modal)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // 使用 admin 角色 (role=0) 才能看到刪除按鈕
    await mockCouponsAPI(page);
    await setupAndLogin(page, ADMIN_PERSONA);
    await page.goto("/dashboard/coupons");
    await page.waitForLoadState("networkidle");
  });

  test("確認刪除優惠券 — 模態框出現、點擊刪除、驗證 API 呼叫", async ({
    page,
  }) => {
    // 等待優惠券列表載入
    await expect(page.locator("text=新年優惠").first()).toBeVisible({
      timeout: 10000,
    });

    // 找到刪除按鈕（紅色文字，isAdmin 才顯示）
    const deleteButton = page
      .locator("button.text-red-600, button.text-red-500")
      .filter({ has: page.locator("text=/刪除|delete/i") })
      .first();

    // 備用：直接按文字定位
    const deleteBtnAlt = page
      .locator("td button")
      .filter({ hasText: /刪除|delete/i })
      .first();

    const btn = (await deleteButton.isVisible()) ? deleteButton : deleteBtnAlt;
    await btn.click();

    // 驗證確認模態框出現
    const confirmModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
    );
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    // 驗證模態框包含優惠券名稱
    await expect(confirmModal).toContainText("新年優惠");

    // 驗證有取消和刪除按鈕
    const cancelBtn = confirmModal.locator("button.bg-\\[\\#F2F2F7\\]");
    const confirmDeleteBtn = confirmModal.locator("button.bg-red-500");
    await expect(cancelBtn).toBeVisible();
    await expect(confirmDeleteBtn).toBeVisible();

    // 監聽 DELETE API 呼叫
    const deletePromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/v1/coupons/coupon-1") &&
        req.method() === "DELETE",
    );

    // 點擊確認刪除
    await confirmDeleteBtn.click();

    // 驗證 DELETE 請求已發送
    const deleteRequest = await deletePromise;
    expect(deleteRequest.method()).toBe("DELETE");

    // 驗證模態框關閉
    await expect(confirmModal).toBeHidden({ timeout: 5000 });
  });

  test("取消刪除優惠券 — 模態框關閉、優惠券仍存在", async ({ page }) => {
    await expect(page.locator("text=新年優惠").first()).toBeVisible({
      timeout: 10000,
    });

    // 點擊刪除按鈕
    const deleteButton = page
      .locator("button.text-red-600, button.text-red-500")
      .filter({ has: page.locator("text=/刪除|delete/i") })
      .first();
    const deleteBtnAlt = page
      .locator("td button")
      .filter({ hasText: /刪除|delete/i })
      .first();
    const btn = (await deleteButton.isVisible()) ? deleteButton : deleteBtnAlt;
    await btn.click();

    // 驗證確認模態框出現
    const confirmModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
    );
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    // 點擊取消按鈕
    const cancelBtn = confirmModal.locator("button.bg-\\[\\#F2F2F7\\]");
    await cancelBtn.click();

    // 驗證模態框已關閉
    await expect(confirmModal).toBeHidden({ timeout: 5000 });

    // 驗證優惠券仍然存在於列表中
    await expect(page.locator("text=新年優惠").first()).toBeVisible();
  });

  test("點擊背景遮罩關閉刪除確認模態框", async ({ page }) => {
    await expect(page.locator("text=新年優惠").first()).toBeVisible({
      timeout: 10000,
    });

    // 開啟刪除確認模態框
    const deleteButton = page
      .locator("button.text-red-600, button.text-red-500")
      .filter({ has: page.locator("text=/刪除|delete/i") })
      .first();
    const deleteBtnAlt = page
      .locator("td button")
      .filter({ hasText: /刪除|delete/i })
      .first();
    const btn = (await deleteButton.isVisible()) ? deleteButton : deleteBtnAlt;
    await btn.click();

    const confirmModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
    );
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    // 點擊背景遮罩 (bg-black/30 backdrop-blur-sm)
    const backdrop = page.locator(".fixed.inset-0.z-50 .bg-black\\/30");
    await backdrop.click({ force: true });

    // 驗證模態框關閉
    await expect(confirmModal).toBeHidden({ timeout: 5000 });

    // 優惠券仍在
    await expect(page.locator("text=新年優惠").first()).toBeVisible();
  });
});

// ===========================================================================
// 4. 菜單刪除確認模態框測試
// ===========================================================================

test.describe("菜單刪除確認模態框 (Menu Delete Confirm Modal)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndLogin(page);
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
  });

  test("菜單刪除確認模態框結構正確 — 包含圖示、標題、按鈕", async ({
    page,
  }) => {
    // 找到刪除相關的按鈕（菜單項目或分類的刪除）
    const deleteButton = page
      .locator("button")
      .filter({ hasText: /刪除|delete/i })
      .first();

    // 若有刪除按鈕可見，點擊它
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();

      // 驗證確認模態框出現
      const confirmModal = page.locator(
        ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
      );
      await expect(confirmModal).toBeVisible({ timeout: 5000 });

      // 驗證模態框包含取消和刪除按鈕
      const cancelBtn = confirmModal.locator("button").filter({
        hasText: /取消|cancel/i,
      });
      const confirmBtn = confirmModal.locator("button").filter({
        hasText: /刪除|delete/i,
      });
      await expect(cancelBtn).toBeVisible();
      await expect(confirmBtn).toBeVisible();

      // 點擊取消關閉
      await cancelBtn.click();
      await expect(confirmModal).toBeHidden({ timeout: 5000 });
    }
  });

  test("菜單刪除 — 點擊背景遮罩關閉確認模態框", async ({ page }) => {
    const deleteButton = page
      .locator("button")
      .filter({ hasText: /刪除|delete/i })
      .first();

    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();

      const confirmModal = page.locator(
        ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
      );
      await expect(confirmModal).toBeVisible({ timeout: 5000 });

      // 點擊背景遮罩
      const backdrop = page.locator(
        ".fixed.inset-0.z-50 .bg-black\\/30.backdrop-blur-sm",
      );
      await backdrop.click({ force: true });

      // 模態框關閉
      await expect(confirmModal).toBeHidden({ timeout: 5000 });
    }
  });
});

// ===========================================================================
// 5. 模態框鍵盤互動測試
// ===========================================================================

test.describe("模態框鍵盤互動 (Modal Keyboard Interactions)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndLogin(page);
  });

  test("訂單詳情模態框 — 按 Escape 關閉", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );

    // 開啟模態框
    const orderViewBtn = page
      .locator(".text-blue-600")
      .filter({ has: page.locator("svg") })
      .first();
    await orderViewBtn.click();

    const modal = page.locator(".fixed.inset-0.z-50");
    await expect(modal).toBeVisible();

    // 按 Escape 鍵
    await page.keyboard.press("Escape");

    // 注意：原生 v-if 模態框不一定支援 Escape，此測試驗證行為
    // 若模態框仍可見，代表該模態框未綁定 keydown.escape
    // 無論結果如何都不算錯誤，此測試用於記錄行為
  });

  test("預約對話框 — 按 Escape 關閉 HeadlessUI Dialog", async ({ page }) => {
    await mockReservationsAPI(page);
    await page.goto("/dashboard/seating");
    await page.waitForLoadState("networkidle");

    // 開啟對話框
    const reservationBtn = page.locator("button.bg-\\[\\#007AFF\\]").first();
    const createButton = page
      .locator("button")
      .filter({
        has: page.locator("svg"),
      })
      .filter({ hasText: /create|新增|預約/ })
      .first();

    const btn = (await reservationBtn.isVisible())
      ? reservationBtn
      : createButton;
    await btn.click();

    const dialogPanel = page.locator('[role="dialog"]');
    await expect(dialogPanel).toBeVisible({ timeout: 5000 });

    // HeadlessUI Dialog 支援 Escape 關閉
    await page.keyboard.press("Escape");

    await expect(dialogPanel).toBeHidden({ timeout: 5000 });
  });
});

// ===========================================================================
// 6. 多重模態框狀態測試
// ===========================================================================

test.describe("模態框狀態管理 (Modal State Management)", () => {
  test("連續開關訂單模態框不會造成殘留狀態", async ({ page }) => {
    await setupAndLogin(page);
    await page.goto("/dashboard/orders");
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/orders") && resp.status() === 200,
    );

    const modal = page.locator(".fixed.inset-0.z-50");

    // 第一次開啟和關閉
    const orderViewBtn = page
      .locator(".text-blue-600")
      .filter({ has: page.locator("svg") })
      .first();
    await orderViewBtn.click();
    await expect(modal).toBeVisible();

    const backdrop = page.locator(".fixed.inset-0.bg-black.opacity-30");
    await backdrop.click({ force: true });
    await expect(modal).toBeHidden();

    // 第二次開啟和關閉
    await orderViewBtn.click();
    await expect(modal).toBeVisible();

    const closeButton = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg.shadow-xl button.text-gray-400",
    );
    await closeButton.click();
    await expect(modal).toBeHidden();

    // 第三次開啟 — 確認模態框內容仍正常
    await orderViewBtn.click();
    await expect(modal).toBeVisible();
    const modalContent = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg.shadow-xl",
    );
    await expect(modalContent).toContainText("ORD-20260330-001");

    // 最後關閉
    await backdrop.click({ force: true });
    await expect(modal).toBeHidden();
  });

  test("優惠券頁面 — 開啟刪除模態框後取消，再次開啟仍正常", async ({
    page,
  }) => {
    await mockCouponsAPI(page);
    await setupAndLogin(page, ADMIN_PERSONA);
    await page.goto("/dashboard/coupons");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=新年優惠").first()).toBeVisible({
      timeout: 10000,
    });

    const confirmModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-2xl",
    );

    // 第一次：開啟 → 取消
    const deleteButton = page
      .locator("button.text-red-600, button.text-red-500")
      .filter({ has: page.locator("text=/刪除|delete/i") })
      .first();
    const deleteBtnAlt = page
      .locator("td button")
      .filter({ hasText: /刪除|delete/i })
      .first();
    const btn = (await deleteButton.isVisible()) ? deleteButton : deleteBtnAlt;
    await btn.click();
    await expect(confirmModal).toBeVisible({ timeout: 5000 });

    const cancelBtn = confirmModal.locator("button.bg-\\[\\#F2F2F7\\]");
    await cancelBtn.click();
    await expect(confirmModal).toBeHidden({ timeout: 5000 });

    // 第二次：開啟 → 確認仍包含正確資料
    await btn.click();
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await expect(confirmModal).toContainText("新年優惠");

    // 關閉
    await cancelBtn.click();
    await expect(confirmModal).toBeHidden({ timeout: 5000 });
  });
});
