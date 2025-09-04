import { test, expect } from "@playwright/test";
import { TestHelpers, TestDataGenerator } from "./utils/test-helpers";

test.describe("核心用戶流程 E2E 測試", () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);

    // 模擬 API 響應
    await helpers.mockAPIResponse(
      /\/restaurants\/1\/menu/,
      TestDataGenerator.generateMenuData(),
    );
    await helpers.mockAPIResponse(
      /\/restaurants\/1$/,
      TestDataGenerator.generateRestaurantData(),
    );
    await helpers.mockAPIResponse(
      /\/orders/,
      TestDataGenerator.generateOrderData(),
    );
  });

  test("完整點餐流程 - 掃描 QR Code 到提交訂單", async ({ page }) => {
    // 1. 進入首頁
    await page.goto("/");
    await helpers.waitForPageLoad();

    // 檢查首頁標題
    await expect(page).toHaveTitle(/MakanMakan/);
    await expect(page.locator("h1")).toContainText("歡迎來到 MakanMakan");

    // 2. 模擬 QR Code 掃描
    await helpers.clickElement('[data-testid="scan-qr-btn"]');

    // 等待相機頁面載入
    await helpers.waitForText("掃描 QR Code");

    // 模擬掃描成功
    await helpers.simulateQRScan(1, 5);

    // 3. 驗證進入菜單頁面
    await expect(page).toHaveURL(/\/restaurant\/1\/table\/5/);
    await helpers.waitForText("Test Restaurant");
    await helpers.waitForText("桌號 5");

    // 4. 瀏覽菜單
    await helpers.waitForText("主餐");
    await helpers.waitForText("飲品");

    // 檢查商品是否顯示
    await helpers.waitForText("牛肉麵");
    await helpers.waitForText("珍珠奶茶");

    // 5. 添加商品到購物車
    await helpers.addItemToCart("牛肉麵", 2);
    await helpers.addItemToCart("珍珠奶茶", 1);

    // 檢查購物車徽章
    await helpers.checkCartItemCount(3);

    // 6. 進入購物車並檢查
    await helpers.clickElement('[data-testid="cart-link"]');
    await helpers.waitForText("購物車");

    // 檢查商品詳情
    await helpers.waitForText("牛肉麵");
    await helpers.waitForText("珍珠奶茶");
    await helpers.waitForText("× 2");
    await helpers.waitForText("× 1");

    // 7. 填寫訂單資訊並提交
    await helpers.submitOrder({
      name: "測試客戶",
      phone: "0912345678",
      notes: "不要太辣，謝謝",
    });

    // 8. 驗證訂單提交成功
    await helpers.waitForText("訂單提交成功");
    await expect(page).toHaveURL(/\/restaurant\/1\/table\/5\/order\/\d+/);

    // 9. 檢查訂單追蹤頁面
    await helpers.waitForText("訂單追蹤");
    await helpers.checkOrderStatus("待確認");
  });

  test("手動輸入餐廳資訊流程", async ({ page }) => {
    // 1. 進入首頁
    await page.goto("/");
    await helpers.waitForPageLoad();

    // 2. 點擊手動輸入
    await helpers.clickElement('[data-testid="manual-input-btn"]');

    // 3. 填寫餐廳資訊
    await helpers.waitForText("輸入餐廳資訊");
    await helpers.fillInput('[data-testid="restaurant-id-input"]', "1");
    await helpers.fillInput('[data-testid="table-id-input"]', "5");

    // 4. 提交
    await helpers.clickElement('[data-testid="confirm-manual-input-btn"]');

    // 5. 驗證進入菜單頁面
    await expect(page).toHaveURL(/\/restaurant\/1\/table\/5/);
    await helpers.waitForText("Test Restaurant");
  });

  test("購物車商品管理", async ({ page }) => {
    // 1. 導航到菜單頁面
    await page.goto("/restaurant/1/table/5");
    await helpers.waitForPageLoad();

    // 2. 添加商品
    await helpers.addItemToCart("牛肉麵", 1);
    await helpers.addItemToCart("珍珠奶茶", 2);

    // 3. 進入購物車
    await helpers.clickElement('[data-testid="cart-link"]');

    // 4. 修改商品數量
    const increaseBtn = page
      .locator('[data-testid="increase-quantity-btn"]')
      .first();
    await increaseBtn.click();
    await helpers.checkCartItemCount(4);

    // 5. 移除商品
    const removeBtn = page.locator('[data-testid="remove-item-btn"]').first();
    await removeBtn.click();
    await helpers.waitForText("已移除");

    // 6. 檢查剩餘商品
    await helpers.waitForText("珍珠奶茶");
    await expect(page.locator("text=牛肉麵")).not.toBeVisible();
  });

  test("訂單狀態更新", async ({ page }) => {
    // 1. 創建訂單（使用之前的流程）
    await page.goto("/restaurant/1/table/5/order/1");
    await helpers.waitForPageLoad();

    // 2. 檢查初始狀態
    await helpers.checkOrderStatus("待確認");

    // 3. 模擬狀態更新（通過 WebSocket 或 API polling）
    await page.evaluate(() => {
      // 模擬訂單狀態更新
      window.dispatchEvent(
        new CustomEvent("order-status-update", {
          detail: { orderId: 1, status: 1, statusText: "已確認" },
        }),
      );
    });

    // 4. 檢查狀態更新
    await helpers.checkOrderStatus("已確認");

    // 5. 繼續模擬其他狀態
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("order-status-update", {
          detail: { orderId: 1, status: 2, statusText: "製作中" },
        }),
      );
    });

    await helpers.checkOrderStatus("製作中");
  });

  test("空購物車狀態", async ({ page }) => {
    // 1. 進入購物車（無商品）
    await page.goto("/restaurant/1/table/5/cart");
    await helpers.waitForPageLoad();

    // 2. 檢查空購物車提示
    await helpers.waitForText("購物車是空的");
    await helpers.waitForText("快去菜單添加一些美味的餐點吧");

    // 3. 點擊瀏覽菜單按鈕
    await helpers.clickElement('[data-testid="browse-menu-btn"]');

    // 4. 驗證跳轉到菜單頁面
    await expect(page).toHaveURL(/\/restaurant\/1\/table\/5/);
  });

  test("錯誤處理 - 網路連接問題", async ({ page }) => {
    // 1. 進入菜單頁面
    await page.goto("/restaurant/1/table/5");
    await helpers.waitForPageLoad();

    // 2. 模擬網路中斷
    await helpers.goOffline();

    // 3. 嘗試操作（應該顯示錯誤）
    await helpers.clickElement('[data-testid="refresh-menu-btn"]');
    await helpers.waitForText("網路連接有問題");

    // 4. 恢復網路
    await helpers.goOnline();

    // 5. 重試操作
    await helpers.clickElement('[data-testid="retry-btn"]');
    await helpers.waitForText("載入成功");
  });

  test("響應式設計 - 移動端體驗", async ({ page, isMobile }) => {
    test.skip(!isMobile, "此測試僅在移動端執行");

    // 1. 進入菜單頁面
    await page.goto("/restaurant/1/table/5");
    await helpers.waitForPageLoad();

    // 2. 檢查移動端佈局
    const menuGrid = page.locator('[data-testid="menu-grid"]');
    await expect(menuGrid).toHaveCSS("display", "grid");

    // 3. 檢查底部導航
    const bottomNav = page.locator('[data-testid="bottom-navigation"]');
    await expect(bottomNav).toBeVisible();

    // 4. 測試手勢操作（滑動等）
    await page.touchscreen.tap(200, 300);
    await page.mouse.wheel(0, 500); // 模擬滾動

    // 5. 檢查購物車浮動按鈕
    const floatingCart = page.locator('[data-testid="floating-cart-btn"]');
    await expect(floatingCart).toBeVisible();
  });
});
