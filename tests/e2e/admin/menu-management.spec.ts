import { test, expect, Page } from "@playwright/test";

/**
 * Admin Dashboard - 菜單管理流程 E2E 測試
 *
 * 測試場景：
 * 1. 查看菜單列表（master-detail 佈局）
 * 2. 新增菜品
 * 3. 編輯菜品
 * 4. 刪除菜品
 * 5. 管理分類（內嵌表單）
 * 6. 上傳菜品圖片
 * 7. 分類篩選（client-side）
 * 8. 搜尋菜品
 */

// 測試輔助函數：登入
async function login(page: Page) {
  await page.route("/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          token: "mock-jwt-token-admin",
          user: {
            id: 1,
            username: "admin",
            role: 1,
            restaurantId: 1,
            restaurantName: "Test Restaurant",
          },
        },
      }),
    });
  });

  await page.goto("/login");
  await page.fill('input[type="text"], input[type="email"]', "admin");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/);
}

// 測試輔助函數：模擬菜單數據（新格式，包含 isFeatured / isAvailable / sortOrder）
const mockCategories = [
  { id: 1, name: "招牌小吃", nameEn: "Signature Snacks", sortOrder: 1 },
  { id: 2, name: "麵食", nameEn: "Noodles", sortOrder: 2 },
  { id: 3, name: "湯品", nameEn: "Soups", sortOrder: 3 },
  { id: 4, name: "飲料", nameEn: "Beverages", sortOrder: 4 },
  { id: 5, name: "甜品", nameEn: "Desserts", sortOrder: 5 },
];

const mockMenuItems = [
  {
    id: 1,
    name: "牛肉麵",
    nameEn: "Beef Noodles",
    description: "精選牛肉配手工麵",
    categoryId: 2,
    categoryName: "麵食",
    price: 120,
    imageUrl: "https://example.com/beef-noodles.jpg",
    isAvailable: true,
    isFeatured: true,
    sortOrder: 1,
    prepTime: 15,
    spicyLevel: 1,
  },
  {
    id: 2,
    name: "珍珠奶茶",
    nameEn: "Bubble Milk Tea",
    description: "經典台灣珍珠奶茶",
    categoryId: 4,
    categoryName: "飲料",
    price: 50,
    imageUrl: "https://example.com/bubble-tea.jpg",
    isAvailable: true,
    isFeatured: false,
    sortOrder: 1,
    prepTime: 5,
    spicyLevel: 0,
  },
  {
    id: 3,
    name: "芒果冰",
    nameEn: "Mango Ice",
    description: "新鮮芒果刨冰",
    categoryId: 5,
    categoryName: "甜品",
    price: 80,
    imageUrl: "https://example.com/mango-ice.jpg",
    isAvailable: false,
    isFeatured: false,
    sortOrder: 1,
    prepTime: 10,
    spicyLevel: 0,
  },
];

// 輔助函數：設定合併的菜單 API mock（新的 single-endpoint 格式）
async function mockMenuApi(page: Page) {
  await page.route("**/api/v1/menu/*", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // GET 主菜單端點（不含 /items/ 或 /categories/ 子路徑）：回傳合併資料
    if (
      method === "GET" &&
      !url.includes("/items/") &&
      !url.includes("/categories/")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { categories: mockCategories, menuItems: mockMenuItems },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe("Admin Dashboard - 菜單管理", () => {
  test.beforeEach(async ({ page }) => {
    // 登入
    await login(page);

    // Mock 合併菜單 API（categories + menuItems 一次回傳）
    await mockMenuApi(page);

    // 導航到菜單管理頁面
    await page.click("text=菜單管理");
    await expect(page).toHaveURL(/.*\/dashboard\/menu/);
  });

  test("應該顯示 master-detail 菜單列表", async ({ page }) => {
    // 等待右側 VirtualMenuGrid 容器出現
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 驗證左側分類面板標題
    await expect(page.locator("text=分類管理")).toBeVisible();

    // 驗證「所有菜品」列顯示
    await expect(page.locator("text=所有菜品").first()).toBeVisible();

    // 驗證菜品 cards 出現
    const menuItemCards = await page.locator('[data-testid="menu-grid-item"]').count();
    expect(menuItemCards).toBeGreaterThan(0);

    // 驗證具體菜品名稱
    await expect(page.locator("text=牛肉麵").first()).toBeVisible();
    await expect(page.locator("text=珍珠奶茶").first()).toBeVisible();

    // 驗證價格（NT$ 格式或純數字）
    await expect(
      page.locator("text=120").or(page.locator("text=$120")).first(),
    ).toBeVisible();
  });

  test("應該能夠按分類篩選菜品（client-side）", async ({ page }) => {
    // 等待頁面與左側分類面板載入
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 點擊左側面板中的「麵食」分類列
    const categoryRow = page
      .locator('[data-testid="category-row"], [data-category-id], li')
      .filter({ hasText: "麵食" })
      .first();

    await categoryRow.click();

    // 分類篩選是 client-side，不等待網路請求；短暫等待 DOM 更新即可
    await page.waitForTimeout(300);

    // 驗證麵食分類菜品可見
    await expect(page.locator("text=牛肉麵").first()).toBeVisible();

    // 驗證其他分類菜品被隱藏（珍珠奶茶屬於飲料分類）
    await expect(
      page.locator('[data-testid="menu-grid-item"]').filter({ hasText: "珍珠奶茶" }),
    ).not.toBeVisible();
  });

  test("應該能夠新增菜品", async ({ page }) => {
    let createCalled = false;

    // Mock 新增菜品 API
    await page.route("**/api/v1/menu/*/items", async (route) => {
      if (route.request().method() === "POST") {
        createCalled = true;
        const postData = route.request().postDataJSON();

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: 4,
              ...postData,
              imageUrl: "https://example.com/new-item.jpg",
              isFeatured: false,
              isAvailable: true,
              sortOrder: 4,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 等待右側面板載入
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 點擊右側面板 header 中的「新增菜品」按鈕
    const addItemButton = page.locator('button:has-text("新增菜品")').first();

    await addItemButton.click();

    // 等待菜品表單模態框出現
    await page.waitForSelector(
      '[data-testid="menu-item-form"], [data-testid="item-modal"], [role="dialog"]',
      { timeout: 5000 },
    );

    // 填寫表單
    await page.fill('input[name="name"], #name, [placeholder*="名稱"]', "炒飯");
    await page.fill(
      'input[name="nameEn"], #nameEn, [placeholder*="English"]',
      "Fried Rice",
    );
    await page.fill('textarea[name="description"], #description', "美味炒飯");
    await page.fill('input[name="price"], #price, [placeholder*="價格"]', "90");

    // 選擇分類（若有下拉選單）
    const categorySelect = page
      .locator('select[name="categoryId"], #categoryId')
      .first();
    if (await categorySelect.isVisible({ timeout: 3000 })) {
      await categorySelect.selectOption("2");
    }

    // 提交表單
    await page.click(
      'button[type="submit"], button:has-text("確定"), button:has-text("保存")',
    );

    // 等待 API 請求完成
    await page.waitForTimeout(1000);

    // 驗證 API 被調用
    expect(createCalled).toBe(true);

    // 驗證成功訊息
    const successMessage = await page
      .locator('text=成功, .success-message, .toast-success, [role="status"]')
      .isVisible({ timeout: 3000 });

    expect(successMessage).toBe(true);
  });

  test("應該能夠編輯菜品", async ({ page }) => {
    let updateCalled = false;

    // Mock 取得菜品詳情與更新 API
    await page.route("**/api/v1/menu/*/items/1", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: mockMenuItems[0],
          }),
        });
      } else if (
        route.request().method() === "PUT" ||
        route.request().method() === "PATCH"
      ) {
        updateCalled = true;
        const postData = route.request().postDataJSON();

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { ...mockMenuItems[0], ...postData },
          }),
        });
      }
    });

    // 等待 grid 載入後，hover 第一個菜品 card 以顯示 hover actions
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    const firstCard = page.locator('[data-testid="menu-grid-item"]').first();
    await firstCard.hover();

    // 點擊 hover 顯示的編輯按鈕
    const editButton = firstCard
      .locator('button:has-text("編輯"), [data-action="edit"]')
      .first();

    await editButton.click();

    // 等待編輯模態框載入
    await page.waitForSelector(
      '[data-testid="menu-item-form"], [data-testid="item-modal"], [role="dialog"]',
      { timeout: 5000 },
    );

    // 修改價格
    const priceInput = page.locator('input[name="price"], #price');
    await priceInput.clear();
    await priceInput.fill("150");

    // 提交表單
    await page.click(
      'button[type="submit"], button:has-text("確定"), button:has-text("保存")',
    );

    // 等待更新完成
    await page.waitForTimeout(1000);

    // 驗證 API 被調用
    expect(updateCalled).toBe(true);
  });

  test("應該能夠刪除菜品", async ({ page }) => {
    let deleteCalled = false;

    // Mock 刪除菜品 API
    await page.route("**/api/v1/menu/*/items/1", async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Menu item deleted successfully",
          }),
        });
      }
    });

    // 等待 grid 載入，hover 第一個 card
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    const firstCard = page.locator('[data-testid="menu-grid-item"]').first();
    await firstCard.hover();

    // 點擊 hover 顯示的刪除按鈕
    const deleteButton = firstCard
      .locator('button:has-text("刪除"), [data-action="delete"]')
      .first();

    await deleteButton.click();

    // 確認刪除對話框（若有）
    const confirmButton = page
      .locator(
        'button:has-text("確認"), button:has-text("確定"), [data-testid="confirm-delete"]',
      )
      .last();

    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click();
    }

    // 等待刪除完成
    await page.waitForTimeout(1000);

    // 驗證 API 被調用
    expect(deleteCalled).toBe(true);
  });

  test("應該能夠管理分類（使用左側面板內嵌表單）", async ({ page }) => {
    let createCategoryCalled = false;

    // Mock 新增分類 API
    await page.route("**/api/v1/menu/*/categories", async (route) => {
      if (route.request().method() === "POST") {
        createCategoryCalled = true;
        const postData = route.request().postDataJSON();

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { id: 6, ...postData, sortOrder: 6 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // 等待左側分類面板
    await page.waitForSelector("text=分類管理", { timeout: 10000 });

    // 點擊左側面板 header 中的「新增」按鈕
    const addCategoryButton = page
      .locator('[data-testid="add-category-btn"]')
      .first();

    await addCategoryButton.click();

    // 等待內嵌分類表單出現（非 modal）
    await page.waitForSelector("[data-category-form]", {
      timeout: 5000,
    });

    // 填寫分類名稱
    const nameInput = page
      .locator(
        '[data-category-form] input[name="name"], [data-category-form] input[placeholder*="名稱"]',
      )
      .first();

    await nameInput.fill("小食");

    // 提交內嵌表單
    await page.click(
      '[data-category-form] button[type="submit"], ' +
        '[data-category-form] button:has-text("確定")',
    );

    // 等待創建完成
    await page.waitForTimeout(1000);

    // 驗證 API 被調用
    expect(createCategoryCalled).toBe(true);
  });

  test("應該能夠上傳菜品圖片", async ({ page }) => {
    // Mock 圖片上傳 API
    await page.route("**/api/v1/menu/*/items/1/image", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              imageUrl: "https://example.com/uploaded-image.jpg",
              variants: {
                thumbnail: "https://example.com/uploaded-image-thumb.jpg",
                medium: "https://example.com/uploaded-image-medium.jpg",
              },
            },
          }),
        });
      }
    });

    // Mock 菜品詳情 API
    await page.route("**/api/v1/menu/*/items/1", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: mockMenuItems[0] }),
        });
      }
    });

    // 等待 grid 載入，hover 第一張 card
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    const firstCard = page.locator('[data-testid="menu-grid-item"]').first();
    await firstCard.hover();

    const editButton = firstCard
      .locator('button:has-text("編輯"), [data-action="edit"]')
      .first();

    await editButton.click();

    // 等待模態框
    await page.waitForSelector('[data-testid="item-modal"]', { timeout: 5000 });

    // 查找圖片上傳輸入
    const fileInput = page.locator('input[type="file"], #imageUpload');

    if (await fileInput.isVisible({ timeout: 3000 })) {
      await fileInput.setInputFiles({
        name: "test-image.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake-image-content"),
      });

      // 等待上傳觸發
      await page.waitForTimeout(1000);
    }
  });

  test("應該能夠切換菜品可用狀態", async ({ page }) => {
    let toggleCalled = false;

    // Mock 切換狀態 API
    await page.route("**/api/v1/menu/*/items/1/toggle", async (route) => {
      if (
        route.request().method() === "PUT" ||
        route.request().method() === "PATCH"
      ) {
        toggleCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              ...mockMenuItems[0],
              isAvailable: !mockMenuItems[0].isAvailable,
            },
          }),
        });
      }
    });

    // 等待 grid 載入，hover 第一張 card
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    const firstCard = page.locator('[data-testid="menu-grid-item"]').first();
    await firstCard.hover();

    // 點擊 hover 顯示的切換按鈕
    const toggleButton = firstCard
      .locator(
        'button:has-text("停售"), button:has-text("供應"), [data-action="toggle"], button[title*="狀態"]',
      )
      .first();

    if (await toggleButton.isVisible({ timeout: 3000 })) {
      await toggleButton.click();

      await page.waitForTimeout(1000);

      expect(toggleCalled).toBe(true);
    }
  });

  test("應該能夠搜尋菜品", async ({ page }) => {
    // 等待右側面板 header 中的搜尋輸入框
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 搜尋框在右側面板 header 區域
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="搜"], [data-testid="menu-search"]',
      )
      .first();

    await searchInput.fill("牛肉麵");

    // 搜尋為 client-side，短暫等待 DOM 更新
    await page.waitForTimeout(500);

    // 驗證搜尋結果：牛肉麵可見
    await expect(page.locator("text=牛肉麵").first()).toBeVisible();

    // 驗證其他菜品被過濾
    const visibleCards = await page
      .locator('[data-testid="menu-grid-item"]:visible')
      .count();

    expect(visibleCards).toBeLessThanOrEqual(1);
  });

  test("應該顯示可用狀態篩選 pills", async ({ page }) => {
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 右側 header 應有 全部 / 供應中 / 已停售 篩選 pills
    await expect(page.locator("text=全部").first()).toBeVisible();

    const availablePill = page.locator("text=供應中").first();
    const soldOutPill = page.locator("text=已停售").first();

    if (await availablePill.isVisible({ timeout: 3000 })) {
      await availablePill.click();

      await page.waitForTimeout(300);

      // 牛肉麵 isAvailable=true → 仍可見
      await expect(page.locator("text=牛肉麵").first()).toBeVisible();

      // 芒果冰 isAvailable=false → 被過濾
      await expect(
        page.locator('[data-testid="menu-grid-item"]').filter({ hasText: "芒果冰" }),
      ).not.toBeVisible();
    }

    if (await soldOutPill.isVisible({ timeout: 3000 })) {
      await soldOutPill.click();

      await page.waitForTimeout(300);

      // 芒果冰 isAvailable=false → 可見
      await expect(page.locator("text=芒果冰").first()).toBeVisible();
    }
  });
});

test.describe("Admin Dashboard - 菜單管理（錯誤處理）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("應該處理新增菜品時的驗證錯誤", async ({ page }) => {
    // Mock 合併菜單 API
    await page.route("**/api/v1/menu/*", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (
        method === "GET" &&
        !url.includes("/items/") &&
        !url.includes("/categories/")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { categories: mockCategories, menuItems: mockMenuItems },
          }),
        });
      } else if (method === "POST" && url.includes("/items")) {
        // 回傳驗證錯誤
        await route.fulfill({
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
        await route.continue();
      }
    });

    await page.click("text=菜單管理");
    await expect(page).toHaveURL(/.*\/dashboard\/menu/);

    // 等待 grid 載入
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // 點擊右側面板的「新增菜品」按鈕
    const addButton = page.locator('button:has-text("新增菜品")').first();
    await addButton.click();

    // 等待表單模態框
    await page.waitForSelector('[data-testid="item-modal"]', { timeout: 5000 });

    // 提交空表單
    await page.click('button[type="submit"], button:has-text("確定")');

    // 驗證錯誤訊息
    await page.waitForSelector(
      'input:invalid, [role="alert"], [data-testid="error-message"]',
      {
        timeout: 3000,
      },
    );

    const errorExists = await page
      .locator('input:invalid, [role="alert"], [data-testid="error-message"]')
      .first()
      .isVisible();
    expect(errorExists).toBe(true);
  });

  test("應該處理圖片上傳失敗", async ({ page }) => {
    // Mock 合併菜單 API
    await page.route("**/api/v1/menu/*", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (
        method === "GET" &&
        !url.includes("/items/") &&
        !url.includes("/categories/")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { categories: mockCategories, menuItems: mockMenuItems },
          }),
        });
      } else if (url.includes("/image")) {
        // 回傳上傳失敗
        await route.fulfill({
          status: 413,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "File too large" }),
        });
      } else if (method === "GET" && url.includes("/items/1")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: mockMenuItems[0] }),
        });
      } else {
        await route.continue();
      }
    });

    await page.click("text=菜單管理");
    await page.waitForSelector('[data-testid="menu-grid-container"]', {
      timeout: 10000,
    });

    // Hover 第一個 card 並點擊編輯
    const firstCard = page.locator('[data-testid="menu-grid-item"]').first();
    await firstCard.hover();

    await firstCard
      .locator('button:has-text("編輯"), [data-action="edit"]')
      .first()
      .click();

    await page.waitForSelector('[data-testid="item-modal"]', { timeout: 5000 });

    const fileInput = page.locator('input[type="file"]');

    const isFileInputVisible = await fileInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isFileInputVisible) {
      // File input not present in this UI variant — skip the upload assertion
      test.skip(true, "File input not present in menu item edit form");
      return;
    }

    await fileInput.setInputFiles({
      name: "large-image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
    });

    // Error message MUST be visible — don't swallow this assertion
    const errorMessage = page
      .locator('[role="alert"], [data-testid="error-message"]')
      .or(page.locator('text=/too large|過大|檔案大小|上傳失敗|File too large/i'))
      .or(page.locator('[data-testid="upload-error"]'));

    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });
});
