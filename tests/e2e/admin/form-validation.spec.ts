/**
 * Admin Dashboard - 表單驗證 E2E 測試
 *
 * 測試場景：
 * 1. 預約表單 — 空欄位提交驗證
 * 2. 預約表單 — 電話號碼格式驗證
 * 3. 預約表單 — 人數邊界值驗證 (min=1, max=20)
 * 4. 預約表單 — 用餐時長邊界值驗證 (min=30, max=240)
 * 5. 預約表單 — 部分欄位填寫後提交
 * 6. 優惠券表單 — 空欄位提交驗證
 * 7. 菜單項目表單 — 空欄位提交驗證
 */

import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "../helpers/mock-api";
import {
  PERSONAS,
  RESTAURANT,
  MENU_ITEMS,
  MENU_CATEGORIES,
} from "../helpers/personas";
import {
  loginAs,
  expectNavigatedTo,
  expectToastMessage,
  expectErrorMessage,
} from "../helpers/assertions";

const ADMIN_APP = "http://localhost:5174";
const API = "**/api/v1";

// ---------------------------------------------------------------------------
// 輔助函數：登入並導航到指定頁面
// ---------------------------------------------------------------------------

async function loginAndNavigate(
  page: import("@playwright/test").Page,
  path: string,
) {
  await mockAllAPIs(page, PERSONAS.OWNER);
  await page.goto(`${ADMIN_APP}/login`);
  await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
  await expectNavigatedTo(page, "/dashboard");
  await page.goto(`${ADMIN_APP}${path}`);
}

// ---------------------------------------------------------------------------
// 輔助函數：開啟預約建立對話框
// ---------------------------------------------------------------------------

async function openReservationCreateDialog(
  page: import("@playwright/test").Page,
) {
  // 等待預約頁面載入
  await page.waitForLoadState("networkidle");

  // 點擊建立預約按鈕（使用多種可能的選擇器）
  const createButton = page.locator(
    'button:has-text("新增預約"), button:has-text("建立預約"), button:has-text("Create"), button:has-text("新增"), [data-testid="create-reservation"]',
  );
  await createButton.first().click({ timeout: 5000 });

  // 等待對話框出現
  await page.waitForSelector(
    '[role="dialog"], .modal, [data-testid="reservation-form"]',
    { timeout: 5000 },
  );
}

// ---------------------------------------------------------------------------
// 輔助函數：取得預約表單的提交按鈕
// ---------------------------------------------------------------------------

function getReservationSubmitButton(page: import("@playwright/test").Page) {
  // 提交按鈕在 footer 區域，使用 btn-primary 或文字匹配
  return page
    .locator(
      '[role="dialog"] button:has-text("建立"), [role="dialog"] button:has-text("確定"), [role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Submit"), .modal button:has-text("建立"), .modal button:has-text("確定")',
    )
    .first();
}

// ===========================================================================
// 預約表單驗證
// ===========================================================================

test.describe("Admin Dashboard - 預約表單驗證", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, "/dashboard/seating");

    // 額外 mock 預約相關 API（mockAllAPIs 已包含 mockQueueAPI，裡面有 reservations）
    // 確保 reservations GET 回傳空列表
    await page.route(`${API}/reservations*`, (route) => {
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
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "res-new",
              confirmationCode: "ABC123",
              status: "pending",
            },
          }),
        });
      } else {
        route.continue();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 1. 空欄位提交 — 應該顯示警告 toast
  // -------------------------------------------------------------------------

  test("空欄位提交應顯示必填欄位警告", async ({ page }) => {
    await openReservationCreateDialog(page);

    // 不填寫任何欄位，直接點擊提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 驗證：應顯示 toast 警告訊息（fillRequired 對應的文字）
    // createReservation() 驗證失敗時顯示 toast.warning(t('common.fillRequired'))
    const warningToast = page.locator(
      '[role="alert"], [data-testid="toast"], .toast, .notification',
    );
    await expect(warningToast.first()).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 2. 電話號碼格式驗證
  // -------------------------------------------------------------------------

  test("無效電話號碼格式應觸發驗證", async ({ page }) => {
    await openReservationCreateDialog(page);

    // 填寫其他必填欄位
    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫姓名
    await dialog.locator('input[type="text"]').first().fill("測試客人");

    // 填寫無效電話號碼
    const phoneInput = dialog.locator('input[type="tel"]').first();
    await phoneInput.fill("abc");

    // 填寫日期和時間
    const dateInput = dialog.locator('input[type="date"]').first();
    const timeInput = dialog.locator('input[type="time"]').first();
    const today = new Date().toISOString().split("T")[0];
    await dateInput.fill(today);
    await timeInput.fill("18:00");

    // 填寫人數
    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("4");

    // 點擊提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 驗證：HTML5 tel 輸入不會自動阻止非數字，
    // 但如果有前端驗證，應顯示錯誤或表單不提交
    // 至少確認頁面仍在對話框狀態（表示表單未成功提交關閉）
    const dialogStillVisible = dialog.isVisible();
    // 如果有額外驗證邏輯，可能會顯示 toast 或錯誤訊息
    const hasWarning = page.locator(
      '[role="alert"], .toast, .notification, .text-red-500, .error-message',
    );
    // 兩種情況都可接受：對話框還在（驗證阻止了提交）或顯示了警告
    const dialogVisible = await dialog.isVisible();
    const warningVisible = await hasWarning
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(dialogVisible || warningVisible).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. 人數邊界值驗證 — partySize min=1, max=20
  // -------------------------------------------------------------------------

  test("人數為 0 時 HTML5 驗證應阻止提交", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫所有必填欄位
    await dialog.locator('input[type="text"]').first().fill("測試客人");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:00");

    // 嘗試設定人數為 0（低於 min=1）
    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("0");

    // 驗證 input 的 min 屬性
    const minValue = await partySizeInput.getAttribute("min");
    expect(minValue).toBe("1");

    // 點擊提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // HTML5 驗證應阻止提交，對話框仍然可見
    await expect(dialog).toBeVisible();
  });

  test("人數為 21 時 HTML5 驗證應阻止提交", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫所有必填欄位
    await dialog.locator('input[type="text"]').first().fill("測試客人");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:00");

    // 嘗試設定人數為 21（超過 max=20）
    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("21");

    // 驗證 input 的 max 屬性
    const maxValue = await partySizeInput.getAttribute("max");
    expect(maxValue).toBe("20");

    // 點擊提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // HTML5 驗證應阻止提交，對話框仍然可見
    await expect(dialog).toBeVisible();
  });

  test("人數為負數時 HTML5 驗證應阻止提交", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    await dialog.locator('input[type="text"]').first().fill("測試客人");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:00");

    // 嘗試設定人數為 -1
    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("-1");

    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 對話框仍然可見（表示表單未通過驗證）
    await expect(dialog).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. 用餐時長邊界值驗證 — min=30, max=240
  // -------------------------------------------------------------------------

  test("用餐時長低於最小值時 HTML5 驗證應阻止提交", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫所有必填欄位
    await dialog.locator('input[type="text"]').first().fill("測試客人");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:00");

    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("4");

    // 找到用餐時長輸入框（第二個 number input）
    const durationInput = dialog.locator('input[type="number"]').nth(1);
    if (await durationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await durationInput.fill("10"); // 低於 min=30

      // 驗證 min 屬性
      const minValue = await durationInput.getAttribute("min");
      expect(minValue).toBe("30");

      // 驗證 max 屬性
      const maxValue = await durationInput.getAttribute("max");
      expect(maxValue).toBe("240");

      // 驗證 step 屬性
      const stepValue = await durationInput.getAttribute("step");
      expect(stepValue).toBe("30");
    }

    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 對話框仍然可見
    await expect(dialog).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. 部分填寫後提交 — 只填姓名和電話，不填日期時間人數
  // -------------------------------------------------------------------------

  test("部分欄位填寫後提交應顯示必填警告", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 只填寫姓名和電話
    await dialog.locator('input[type="text"]').first().fill("測試客人");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    // 不填日期、時間、人數 → 提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 驗證：createReservation() 檢查 !formDate.value || !formTime.value || !form.partySize
    // 應顯示 toast 警告
    const warningToast = page.locator(
      '[role="alert"], [data-testid="toast"], .toast, .notification',
    );
    await expect(warningToast.first()).toBeVisible({ timeout: 5000 });
  });

  test("只填日期時間但不填姓名電話人數應顯示警告", async ({ page }) => {
    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 只填日期和時間
    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:00");

    // 不填姓名、電話、人數 → 提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 驗證：應顯示 toast 警告（!form.customerName || !form.customerPhone || !form.partySize）
    const warningToast = page.locator(
      '[role="alert"], [data-testid="toast"], .toast, .notification',
    );
    await expect(warningToast.first()).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 6. 取消按鈕 — 不應提交表單
  // -------------------------------------------------------------------------

  test("點擊取消按鈕應關閉對話框而不提交", async ({ page }) => {
    let postCalled = false;

    // 監聽是否有 POST 請求發出
    await page.route(`${API}/reservations`, (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
      }
      route.continue();
    });

    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫部分資料
    await dialog.locator('input[type="text"]').first().fill("測試客人");

    // 點擊取消按鈕
    const cancelButton = dialog
      .locator('button:has-text("取消"), button:has-text("Cancel")')
      .first();
    await cancelButton.click();

    // 驗證：對話框應該關閉
    await expect(dialog).toBeHidden({ timeout: 3000 });

    // 驗證：POST API 未被呼叫
    expect(postCalled).toBe(false);
  });
});

// ===========================================================================
// 優惠券表單驗證
// ===========================================================================

test.describe("Admin Dashboard - 優惠券表單驗證", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, "/dashboard/coupons");

    // Mock 優惠券列表 API
    await page.route(`${API}/coupons`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
        });
      } else if (route.request().method() === "POST") {
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { id: "coupon-new", code: "TEST10", status: "active" },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock 優惠券統計 API
    await page.route(`${API}/coupons/stats/summary`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            totalCoupons: 0,
            activeCoupons: 0,
            totalRedemptions: 0,
            totalDiscount: 0,
          },
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 7. 優惠券空欄位提交
  // -------------------------------------------------------------------------

  test("空欄位提交優惠券表單應顯示驗證錯誤", async ({ page }) => {
    // 等待頁面載入
    await page.waitForLoadState("networkidle");

    // 點擊新增優惠券按鈕（PlusIcon + 文字）
    const createButton = page.locator(
      'button:has-text("新增"), button:has-text("建立"), button:has-text("Create"), button:has-text("Add"), [data-testid="create-coupon"]',
    );
    await createButton.first().click({ timeout: 5000 });

    // 等待 CouponFormModal 出現（透過 Suspense 載入）
    await page.waitForSelector(
      '[role="dialog"], .modal, [data-testid="coupon-form"]',
      { timeout: 5000 },
    );

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 不填寫任何欄位，直接提交
    const submitButton = dialog
      .locator(
        'button[type="submit"], button:has-text("確定"), button:has-text("建立"), button:has-text("Save"), button:has-text("Create")',
      )
      .first();
    await submitButton.click();

    // 驗證：應顯示驗證錯誤（HTML5 required 或前端驗證）
    // 表單應該不會關閉
    await expect(dialog).toBeVisible();

    // 可能有錯誤訊息出現
    const hasError = page.locator(
      '[role="alert"], .error-message, .text-red-500, .text-ios-red, .toast, .notification',
    );
    const errorVisible = await hasError
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    // 即使沒有錯誤訊息，只要對話框沒關閉就代表驗證生效
    expect((await dialog.isVisible()) || errorVisible).toBe(true);
  });
});

// ===========================================================================
// 菜單項目表單驗證
// ===========================================================================

test.describe("Admin Dashboard - 菜單項目表單驗證", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, "/dashboard/menu");

    // Mock 合併菜單 API
    await page.route(new RegExp(`/api/v1/menu/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              categories: MENU_CATEGORIES,
              menuItems: MENU_ITEMS,
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock 新增菜品 API — 回傳驗證錯誤
    await page.route(new RegExp(`/api/v1/menu/.+/items`), (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: {
                name: "Name is required",
                price: "Price must be positive",
              },
            },
          }),
        });
      } else {
        route.continue();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. 菜品空欄位提交
  // -------------------------------------------------------------------------

  test("空欄位提交菜品表單應顯示驗證錯誤", async ({ page }) => {
    // 等待右側面板載入
    await page.waitForSelector(".virtual-menu-grid-container", {
      timeout: 10000,
    });

    // 點擊新增菜品按鈕
    const addButton = page
      .locator(
        'button:has-text("新增菜品"), button:has-text("Add"), [data-testid="add-menu-item"]',
      )
      .first();
    await addButton.click();

    // 等待表單模態框出現
    await page.waitForSelector(
      '[data-testid="menu-item-form"], .modal, [role="dialog"]',
      { timeout: 5000 },
    );

    // 不填寫任何欄位，直接提交
    await page.click(
      'button[type="submit"], button:has-text("確定"), button:has-text("保存")',
    );

    // 等待錯誤訊息出現
    const errorMessage = page.locator(
      '.error-message, .text-red-500, [role="alert"], .toast, .notification',
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// 預約表單成功提交（驗證通過的正向測試）
// ===========================================================================

test.describe("Admin Dashboard - 預約表單正向測試", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page, "/dashboard/seating");
  });

  test("填寫所有必填欄位後應成功提交", async ({ page }) => {
    let postCalled = false;
    let postBody: any = null;

    // Mock reservations API
    await page.route(`${API}/reservations*`, (route) => {
      const method = route.request().method();
      if (method === "POST") {
        postCalled = true;
        postBody = route.request().postDataJSON();
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "res-new",
              confirmationCode: "ABC123",
              status: "pending",
            },
          }),
        });
      } else if (method === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { total: 0 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await openReservationCreateDialog(page);

    const dialog = page.locator('[role="dialog"], .modal').first();

    // 填寫所有必填欄位
    await dialog.locator('input[type="text"]').first().fill("陳小明");
    await dialog.locator('input[type="tel"]').first().fill("0912345678");

    const today = new Date().toISOString().split("T")[0];
    await dialog.locator('input[type="date"]').first().fill(today);
    await dialog.locator('input[type="time"]').first().fill("18:30");

    // 人數
    const partySizeInput = dialog.locator('input[type="number"]').first();
    await partySizeInput.fill("4");

    // 可選：填寫 email
    const emailInput = dialog.locator('input[type="email"]');
    if (
      await emailInput
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await emailInput.first().fill("chen@test.com");
    }

    // 提交
    const submitButton = getReservationSubmitButton(page);
    await submitButton.click();

    // 等待表單處理
    await page.waitForTimeout(1000);

    // 驗證：POST API 被呼叫
    expect(postCalled).toBe(true);

    // 驗證：提交的資料包含正確的客戶姓名
    if (postBody) {
      expect(postBody).toEqual(
        expect.objectContaining({
          customerName: "陳小明",
          customerPhone: "0912345678",
        }),
      );
    }
  });
});
