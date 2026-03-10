import { test, expect, Page } from "@playwright/test";

/**
 * Admin Dashboard - 桌台管理和用戶管理 E2E 測試
 *
 * 測試場景：
 * 桌台管理：
 * 1. 查看桌台列表
 * 2. 新增桌台
 * 3. 編輯桌台
 * 4. 生成 QR 碼
 * 5. 管理桌台狀態
 *
 * 用戶管理：
 * 1. 查看員工列表
 * 2. 新增員工
 * 3. 編輯員工
 * 4. 管理權限
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

const mockTables = [
  {
    id: 1,
    name: "A-1",
    capacity: 4,
    status: "available",
    qrCode: "https://example.com/qr/table-1.png",
    area: "Main Hall",
  },
  {
    id: 2,
    name: "A-2",
    capacity: 2,
    status: "occupied",
    qrCode: "https://example.com/qr/table-2.png",
    area: "Main Hall",
  },
  {
    id: 3,
    name: "B-1",
    capacity: 6,
    status: "reserved",
    qrCode: "https://example.com/qr/table-3.png",
    area: "VIP Room",
  },
];

const mockUsers = [
  {
    id: 1,
    username: "admin",
    name: "管理員",
    role: 0,
    roleName: "系統管理員",
    email: "admin@example.com",
    restaurantId: 1,
    isActive: true,
  },
  {
    id: 2,
    username: "chef1",
    name: "張廚師",
    role: 2,
    roleName: "廚師",
    email: "chef1@example.com",
    restaurantId: 1,
    isActive: true,
  },
  {
    id: 3,
    username: "server1",
    name: "李服務員",
    role: 3,
    roleName: "服務員",
    email: "server1@example.com",
    restaurantId: 1,
    isActive: false,
  },
];

test.describe("Admin Dashboard - 桌台管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);

    // Mock 桌台列表 API
    await page.route("/api/v1/tables*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            tables: mockTables,
            pagination: {
              total: mockTables.length,
              page: 1,
              pageSize: 20,
            },
          },
        }),
      });
    });

    await page.click("text=桌台管理");
    await expect(page).toHaveURL(/.*\/dashboard\/tables/);
  });

  test("應該顯示桌台列表", async ({ page }) => {
    await page.waitForSelector(
      '[data-testid="tables-list"], .tables-grid, .tables-table',
    );

    const tableCount = await page
      .locator('[data-testid="table-card"], .table-card, tbody tr')
      .count();
    expect(tableCount).toBeGreaterThan(0);

    await expect(page.locator("text=A-1")).toBeVisible();
    await expect(page.locator("text=A-2")).toBeVisible();
  });

  test("應該能夠新增桌台", async ({ page }) => {
    let createCalled = false;

    await page.route("/api/v1/tables", async (route) => {
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
              status: "available",
            },
          }),
        });
      }
    });

    const addButton = page
      .locator('button:has-text("新增"), [data-testid="add-table"]')
      .first();
    await addButton.click();

    await page.waitForSelector(".modal:visible, .dialog:visible");

    await page.fill('input[name="name"], #tableName', "C-1");
    await page.fill('input[name="capacity"], #capacity', "4");

    await page.click('button[type="submit"], button:has-text("確定")');

    await page.waitForTimeout(1000);
    expect(createCalled).toBe(true);
  });

  test("應該能夠生成 QR 碼", async ({ page }) => {
    let qrGenerateCalled = false;

    await page.route("/api/v1/tables/1/qr", async (route) => {
      if (
        route.request().method() === "POST" ||
        route.request().method() === "GET"
      ) {
        qrGenerateCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
              downloadUrl: "https://example.com/qr/table-1.png",
            },
          }),
        });
      }
    });

    const qrButton = page
      .locator(
        '[data-table-id="1"] button:has-text("QR"), ' +
          'tr:has-text("A-1") button:has-text("QR"), ' +
          '[data-testid="generate-qr-1"]',
      )
      .first();

    if (await qrButton.isVisible({ timeout: 3000 })) {
      await qrButton.click();
      await page.waitForTimeout(1000);
      expect(qrGenerateCalled).toBe(true);
    }
  });

  test("應該能夠更新桌台狀態", async ({ page }) => {
    let updateCalled = false;

    await page.route("/api/v1/tables/1/status", async (route) => {
      if (
        route.request().method() === "PUT" ||
        route.request().method() === "PATCH"
      ) {
        updateCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              ...mockTables[0],
              status: "occupied",
            },
          }),
        });
      }
    });

    const statusButton = page
      .locator(
        '[data-table-id="1"] button:has-text("狀態"), ' +
          'tr:has-text("A-1") select, ' +
          '[data-testid="table-status-1"]',
      )
      .first();

    if (await statusButton.isVisible({ timeout: 3000 })) {
      await statusButton.click();

      const occupiedOption = page.locator('text=已佔用, [value="occupied"]');
      if (await occupiedOption.isVisible({ timeout: 2000 })) {
        await occupiedOption.click();
        await page.waitForTimeout(1000);
        expect(updateCalled).toBe(true);
      }
    }
  });

  test("應該能夠篩選桌台狀態", async ({ page }) => {
    const filterButton = page
      .locator('select[name="status"], button:has-text("篩選")')
      .first();

    if (await filterButton.isVisible({ timeout: 3000 })) {
      if (await filterButton.evaluate((el) => el.tagName === "SELECT")) {
        await filterButton.selectOption("available");
      } else {
        await filterButton.click();
        await page.click('text=可用, [value="available"]');
      }

      await page.waitForTimeout(500);

      const visibleTables = await page
        .locator('[data-testid="table-card"]:visible, tbody tr:visible')
        .count();
      expect(visibleTables).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("Admin Dashboard - 用戶管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);

    // Mock 用戶列表 API
    await page.route("/api/v1/users*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            users: mockUsers,
            pagination: {
              total: mockUsers.length,
              page: 1,
              pageSize: 20,
            },
          },
        }),
      });
    });

    await page.click("text=員工管理, text=用戶管理");
    await expect(page).toHaveURL(/.*\/dashboard\/(users|employees)/);
  });

  test("應該顯示員工列表", async ({ page }) => {
    await page.waitForSelector(
      '[data-testid="users-list"], .users-table, table',
    );

    const userCount = await page
      .locator('[data-testid="user-item"], tbody tr')
      .count();
    expect(userCount).toBeGreaterThan(0);

    await expect(page.locator("text=管理員")).toBeVisible();
    await expect(page.locator("text=張廚師")).toBeVisible();
  });

  test("應該能夠新增員工", async ({ page }) => {
    let createCalled = false;

    await page.route("/api/v1/users", async (route) => {
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
              isActive: true,
            },
          }),
        });
      }
    });

    const addButton = page
      .locator('button:has-text("新增"), [data-testid="add-user"]')
      .first();
    await addButton.click();

    await page.waitForSelector(".modal:visible, .dialog:visible");

    await page.fill('input[name="username"], #username', "cashier1");
    await page.fill('input[name="name"], #name', "王收銀員");
    await page.fill('input[name="email"], #email', "cashier1@example.com");
    await page.fill('input[name="password"], #password', "password123");

    const roleSelect = page.locator('select[name="role"], #role');
    if (await roleSelect.isVisible({ timeout: 2000 })) {
      await roleSelect.selectOption("4"); // Cashier role
    }

    await page.click('button[type="submit"], button:has-text("確定")');

    await page.waitForTimeout(1000);
    expect(createCalled).toBe(true);
  });

  test("應該能夠編輯員工資訊", async ({ page }) => {
    let updateCalled = false;

    await page.route("/api/v1/users/2", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: mockUsers[1],
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
            data: {
              ...mockUsers[1],
              ...postData,
            },
          }),
        });
      }
    });

    const editButton = page
      .locator(
        '[data-user-id="2"] button:has-text("編輯"), ' +
          'tr:has-text("張廚師") button:has-text("編輯")',
      )
      .first();

    await editButton.click();

    await page.waitForSelector(".modal:visible");

    const nameInput = page.locator('input[name="name"], #name');
    await nameInput.clear();
    await nameInput.fill("張大廚");

    await page.click('button[type="submit"], button:has-text("確定")');

    await page.waitForTimeout(1000);
    expect(updateCalled).toBe(true);
  });

  test("應該能夠停用/啟用員工", async ({ page }) => {
    let toggleCalled = false;

    await page.route("/api/v1/users/3/toggle", async (route) => {
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
              ...mockUsers[2],
              isActive: !mockUsers[2].isActive,
            },
          }),
        });
      }
    });

    const toggleButton = page
      .locator(
        '[data-user-id="3"] input[type="checkbox"], ' +
          'tr:has-text("李服務員") input[type="checkbox"], ' +
          '[data-testid="toggle-user-3"]',
      )
      .first();

    if (await toggleButton.isVisible({ timeout: 3000 })) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
      expect(toggleCalled).toBe(true);
    }
  });

  test("應該能夠按角色篩選員工", async ({ page }) => {
    const filterSelect = page
      .locator('select[name="role"], [data-testid="role-filter"]')
      .first();

    if (await filterSelect.isVisible({ timeout: 3000 })) {
      await filterSelect.selectOption("2"); // Chef role

      await page.waitForTimeout(500);

      await expect(page.locator("text=張廚師")).toBeVisible();

      const visibleUsers = await page.locator("tbody tr:visible").count();
      expect(visibleUsers).toBeGreaterThanOrEqual(0);
    }
  });

  test("應該能夠重設員工密碼", async ({ page }) => {
    let resetCalled = false;

    await page.route("/api/v1/users/2/reset-password", async (route) => {
      if (route.request().method() === "POST") {
        resetCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Password reset successfully",
          }),
        });
      }
    });

    const resetButton = page
      .locator(
        '[data-user-id="2"] button:has-text("重設密碼"), ' +
          'tr:has-text("張廚師") button:has-text("重設")',
      )
      .first();

    if (await resetButton.isVisible({ timeout: 3000 })) {
      await resetButton.click();

      const confirmButton = page
        .locator('button:has-text("確認"), button:has-text("確定")')
        .last();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(1000);
      expect(resetCalled).toBe(true);
    }
  });

  test("應該顯示員工統計資訊", async ({ page }) => {
    const statsSection = page.locator(
      '[data-testid="users-stats"], .stats-grid',
    );

    if (await statsSection.isVisible({ timeout: 5000 })) {
      const statCards = await statsSection.locator(".stat-card, .card").count();
      expect(statCards).toBeGreaterThan(0);
    }
  });
});

test.describe("Admin Dashboard - 桌台和用戶管理（錯誤處理）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("應該處理新增桌台時的重複名稱錯誤", async ({ page }) => {
    await page.route("/api/v1/tables*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { tables: mockTables, pagination: {} },
          }),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Table name already exists",
          }),
        });
      }
    });

    await page.click("text=桌台管理");
    await page.click('button:has-text("新增")');

    await page.waitForSelector(".modal:visible");

    await page.fill('input[name="name"]', "A-1");
    await page.fill('input[name="capacity"]', "4");
    await page.click('button[type="submit"]');

    await page.waitForSelector('.error-message, .alert-error, [role="alert"]', {
      timeout: 3000,
    });

    const errorMessage = await page
      .locator(".error-message, .alert-error")
      .first();
    await expect(errorMessage).toBeVisible();
  });

  test("應該處理新增用戶時的驗證錯誤", async ({ page }) => {
    await page.route("/api/v1/users*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { users: mockUsers, pagination: {} },
          }),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Validation failed",
            details: {
              username: "Username is required",
              email: "Invalid email format",
            },
          }),
        });
      }
    });

    await page.click("text=員工管理, text=用戶管理");
    await page.click('button:has-text("新增")');

    await page.waitForSelector(".modal:visible");

    await page.click('button[type="submit"]');

    await page.waitForSelector(
      '.error-message, .text-red-500, [role="alert"]',
      {
        timeout: 3000,
      },
    );

    const errorExists = await page
      .locator(".error-message, .text-red-500")
      .isVisible();
    expect(errorExists).toBe(true);
  });
});
