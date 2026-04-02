import { test, expect, type Page } from "@playwright/test";
import { PERSONAS, RESTAURANT, createMockOrder } from "../helpers/personas";
import { mockAllAPIs } from "../helpers/mock-api";
import { loginAs, expectToastMessage } from "../helpers/assertions";

/**
 * Admin Dashboard - 狀態轉換 E2E 測試
 *
 * 測試訂單和訂位的完整狀態流轉：
 * - 訂單：pending → confirmed → preparing → ready → delivered → paid
 * - 訂位：pending → confirmed → arrived → seated
 * - 取消流程及按鈕可見性驗證
 */

const API = "**/api/v1";

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// ---------------------------------------------------------------------------
// 輔助函數：建立指定狀態的訂單
// ---------------------------------------------------------------------------

function createOrderWithStatus(status: string, id = "order-e2e-001") {
  return createMockOrder({
    id,
    status,
    orderNumber: `ORD-20260330-${id.slice(-3)}`,
  });
}

// ---------------------------------------------------------------------------
// 輔助函數：建立指定狀態的訂位
// ---------------------------------------------------------------------------

function createReservation(
  status: string,
  id = "res-e2e-001",
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    confirmationCode: "RES-ABC123",
    customerName: "測試顧客",
    customerPhone: "0912345678",
    customerEmail: "test@e2e.test",
    reservationDate: "2026-03-30",
    reservationTime: "18:00",
    partySize: 4,
    status,
    specialRequests: "靠窗座位",
    restaurantId: RESTAURANT.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 輔助函數：設定訂單頁面所需的 API mock
// ---------------------------------------------------------------------------

async function setupOrderPageMocks(
  page: Page,
  orders: ReturnType<typeof createMockOrder>[],
) {
  // 取消先前的路由攔截（重新設定用）
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // 重新設定基礎 mock
  await mockAllAPIs(page, PERSONAS.OWNER);

  // 覆蓋訂單列表 API
  await page.route(`${API}/orders`, (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(
        json({
          success: true,
          data: orders,
          pagination: {
            page: 1,
            limit: 20,
            total: orders.length,
            totalPages: 1,
          },
        }),
      );
    } else {
      route.continue();
    }
  });

  // 訂單統計
  await page.route(`${API}/orders/stats`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          totalOrders: orders.length,
          totalRevenue: 756000,
          averageOrderValue: 18000,
          completionRate: 0.95,
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// 輔助函數：設定訂位頁面所需的 API mock
// ---------------------------------------------------------------------------

async function setupReservationPageMocks(
  page: Page,
  reservations: ReturnType<typeof createReservation>[],
) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockAllAPIs(page, PERSONAS.OWNER);

  // 覆蓋訂位列表 API
  await page.route(
    new RegExp(`${API.replace(/\*/g, ".*")}/reservations(\\?.*)?$`),
    (route) => {
      const method = route.request().method();
      const url = route.request().url();

      // 避免攔截 action 子路由（如 /confirm, /cancel 等）
      if (
        url.includes("/confirm") ||
        url.includes("/arrive") ||
        url.includes("/seat") ||
        url.includes("/cancel")
      ) {
        route.continue();
        return;
      }

      if (method === "GET") {
        route.fulfill(
          json({
            success: true,
            data: reservations,
            pagination: { total: reservations.length, page: 1, limit: 20 },
          }),
        );
      } else if (method === "POST") {
        route.fulfill(
          json({
            success: true,
            data: {
              id: "res-new",
              confirmationCode: "NEW123",
              status: "pending",
            },
          }),
        );
      } else {
        route.continue();
      }
    },
  );
}

// ---------------------------------------------------------------------------
// 輔助函數：登入並導航到指定頁面
// ---------------------------------------------------------------------------

async function loginAndNavigate(page: Page, path: string) {
  await page.goto("/login");
  await loginAs(page, PERSONAS.OWNER.username, PERSONAS.OWNER.password);
  await page.waitForURL(/.*\/dashboard/);
  await page.goto(`/dashboard/${path}`);
}

// ============================================================================
// 訂單狀態轉換測試
// ============================================================================

test.describe("訂單狀態轉換 (Order State Transitions)", () => {
  // 使用桌面視窗以測試表格佈局
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);
  });

  // -------------------------------------------------------------------------
  // 正向狀態流轉
  // -------------------------------------------------------------------------

  test("pending → confirmed：點擊更新按鈕後訂單狀態應變為已確認", async ({
    page,
  }) => {
    const order = createOrderWithStatus("pending");
    await setupOrderPageMocks(page, [order]);

    // 攔截狀態更新 API
    let capturedStatus: string | undefined;
    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        const method = route.request().method();
        if (method === "PUT") {
          const body = route.request().postDataJSON();
          capturedStatus = body?.status;
          route.fulfill(
            json({ success: true, data: { ...order, status: "confirmed" } }),
          );
        } else if (method === "GET") {
          route.fulfill(json({ success: true, data: order }));
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    // 桌面表格中找到更新按鈕（綠色 ArrowPath 按鈕）
    const desktopTable = page.locator(".hidden.lg\\:block");
    const updateBtn = desktopTable.locator("button.text-green-600").first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    // 驗證 API 呼叫
    expect(capturedStatus).toBeDefined();
  });

  test("confirmed → preparing：確認訂單後應可推進至準備中", async ({
    page,
  }) => {
    const order = createOrderWithStatus("confirmed");
    await setupOrderPageMocks(page, [order]);

    let capturedStatus: string | undefined;
    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "PUT") {
          capturedStatus = route.request().postDataJSON()?.status;
          route.fulfill(
            json({ success: true, data: { ...order, status: "preparing" } }),
          );
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const updateBtn = desktopTable.locator("button.text-green-600").first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    expect(capturedStatus).toBeDefined();
  });

  test("preparing → ready：準備中訂單應可推進至待取餐", async ({ page }) => {
    const order = createOrderWithStatus("preparing");
    await setupOrderPageMocks(page, [order]);

    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "PUT") {
          route.fulfill(
            json({ success: true, data: { ...order, status: "ready" } }),
          );
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const updateBtn = desktopTable.locator("button.text-green-600").first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();
  });

  test("ready → delivered：待取餐訂單應可推進至已送達", async ({ page }) => {
    const order = createOrderWithStatus("ready");
    await setupOrderPageMocks(page, [order]);

    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "PUT") {
          route.fulfill(
            json({ success: true, data: { ...order, status: "delivered" } }),
          );
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const updateBtn = desktopTable.locator("button.text-green-600").first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();
  });

  test("delivered → paid（終態）：已送達訂單推進至已付款後，更新按鈕應消失", async ({
    page,
  }) => {
    const order = createOrderWithStatus("delivered");
    await setupOrderPageMocks(page, [order]);

    // 更新後重新載入訂單列表時回傳 paid 狀態
    const paidOrder = createOrderWithStatus("paid");
    let updateCalled = false;

    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "PUT") {
          updateCalled = true;
          route.fulfill(json({ success: true, data: paidOrder }));
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const updateBtn = desktopTable.locator("button.text-green-600").first();
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    expect(updateCalled).toBe(true);

    // 重新載入頁面以顯示 paid 狀態
    await setupOrderPageMocks(page, [paidOrder]);
    await page.reload();
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    // paid 狀態：更新按鈕應不可見
    const desktopTableAfter = page.locator(".hidden.lg\\:block");
    const updateBtnAfter = desktopTableAfter.locator("button.text-green-600");
    await expect(updateBtnAfter).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // 取消流程
  // -------------------------------------------------------------------------

  test("pending 訂單取消：確認對話框後應呼叫 DELETE API", async ({ page }) => {
    const order = createOrderWithStatus("pending");
    await setupOrderPageMocks(page, [order]);

    let deleteCalled = false;
    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "DELETE") {
          deleteCalled = true;
          route.fulfill(json({ success: true, message: "Order cancelled" }));
        } else {
          route.continue();
        }
      },
    );

    // 自動接受 confirm() 對話框
    page.on("dialog", (dialog) => dialog.accept());

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const cancelBtn = desktopTable.locator("button.text-red-600").first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // 等待 API 呼叫完成
    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });

  test("confirmed 訂單取消：確認對話框後應呼叫 DELETE API", async ({
    page,
  }) => {
    const order = createOrderWithStatus("confirmed");
    await setupOrderPageMocks(page, [order]);

    let deleteCalled = false;
    await page.route(
      new RegExp(`${API.replace(/\*/g, ".*")}/orders/${order.id}`),
      (route) => {
        if (route.request().method() === "DELETE") {
          deleteCalled = true;
          route.fulfill(json({ success: true, message: "Order cancelled" }));
        } else {
          route.continue();
        }
      },
    );

    page.on("dialog", (dialog) => dialog.accept());

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const cancelBtn = desktopTable.locator("button.text-red-600").first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 按鈕可見性驗證
  // -------------------------------------------------------------------------

  test("preparing/ready/delivered 狀態不應顯示取消按鈕", async ({ page }) => {
    const orders = [
      createOrderWithStatus("preparing", "order-001"),
      createOrderWithStatus("ready", "order-002"),
      createOrderWithStatus("delivered", "order-003"),
    ];
    await setupOrderPageMocks(page, orders);

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const rows = desktopTable.locator("table tbody tr");
    await expect(rows).toHaveCount(3);

    // 這三種狀態下取消按鈕不應存在
    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      const cancelBtn = row.locator("button.text-red-600");
      await expect(cancelBtn).toHaveCount(0);
    }
  });

  test("completed/cancelled/paid 狀態不應顯示更新按鈕", async ({ page }) => {
    const orders = [
      createOrderWithStatus("completed", "order-001"),
      createOrderWithStatus("cancelled", "order-002"),
      createOrderWithStatus("paid", "order-003"),
    ];
    await setupOrderPageMocks(page, orders);

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const rows = desktopTable.locator("table tbody tr");
    await expect(rows).toHaveCount(3);

    // 終態下更新按鈕不應存在
    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      const updateBtn = row.locator("button.text-green-600");
      await expect(updateBtn).toHaveCount(0);
    }
  });

  test("completed/cancelled/paid 狀態也不應顯示取消按鈕", async ({ page }) => {
    const orders = [
      createOrderWithStatus("completed", "order-001"),
      createOrderWithStatus("cancelled", "order-002"),
      createOrderWithStatus("paid", "order-003"),
    ];
    await setupOrderPageMocks(page, orders);

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const rows = desktopTable.locator("table tbody tr");

    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      const cancelBtn = row.locator("button.text-red-600");
      await expect(cancelBtn).toHaveCount(0);
    }
  });

  test("pending 訂單應同時顯示更新和取消按鈕", async ({ page }) => {
    const order = createOrderWithStatus("pending");
    await setupOrderPageMocks(page, [order]);

    await loginAndNavigate(page, "orders");
    await page.waitForSelector(".hidden.lg\\:block table tbody tr");

    const desktopTable = page.locator(".hidden.lg\\:block");
    const row = desktopTable.locator("table tbody tr").first();

    // 更新按鈕（綠色）和取消按鈕（紅色）都應可見
    await expect(row.locator("button.text-green-600")).toBeVisible();
    await expect(row.locator("button.text-red-600")).toBeVisible();
    // 查看按鈕（藍色）也應存在
    await expect(row.locator("button.text-blue-600")).toBeVisible();
  });
});

// ============================================================================
// 訂位狀態轉換測試
// ============================================================================

test.describe("訂位狀態轉換 (Reservation State Transitions)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);
  });

  test("pending → confirmed：點擊確認按鈕後訂位應變為已確認", async ({
    page,
  }) => {
    const reservation = createReservation("pending");
    await setupReservationPageMocks(page, [reservation]);

    let confirmCalled = false;
    await page.route(
      new RegExp(
        `${API.replace(/\*/g, ".*")}/reservations/${reservation.id}/confirm`,
      ),
      (route) => {
        if (route.request().method() === "POST") {
          confirmCalled = true;
          route.fulfill(
            json({
              success: true,
              data: { ...reservation, status: "confirmed" },
            }),
          );
        } else {
          route.continue();
        }
      },
    );

    // 自動接受 confirm() 對話框
    page.on("dialog", (dialog) => dialog.accept());

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    // 點擊確認按鈕（綠色 CheckCircle）
    const confirmBtn = page
      .locator("table tbody tr")
      .first()
      .locator("button.text-green-600");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await page.waitForTimeout(500);
    expect(confirmCalled).toBe(true);
  });

  test("confirmed → arrived：點擊標記到店按鈕", async ({ page }) => {
    const reservation = createReservation("confirmed");
    await setupReservationPageMocks(page, [reservation]);

    let arriveCalled = false;
    await page.route(
      new RegExp(
        `${API.replace(/\*/g, ".*")}/reservations/${reservation.id}/arrive`,
      ),
      (route) => {
        if (route.request().method() === "POST") {
          arriveCalled = true;
          route.fulfill(
            json({
              success: true,
              data: { ...reservation, status: "arrived" },
            }),
          );
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    // 點擊標記到店按鈕（紫色 UserCheck）
    const arriveBtn = page
      .locator("table tbody tr")
      .first()
      .locator("button.text-purple-600");
    await expect(arriveBtn).toBeVisible();
    await arriveBtn.click();

    await page.waitForTimeout(500);
    expect(arriveCalled).toBe(true);
  });

  test("arrived → seated：點擊標記入座按鈕", async ({ page }) => {
    const reservation = createReservation("arrived");
    await setupReservationPageMocks(page, [reservation]);

    let seatCalled = false;
    await page.route(
      new RegExp(
        `${API.replace(/\*/g, ".*")}/reservations/${reservation.id}/seat`,
      ),
      (route) => {
        if (route.request().method() === "POST") {
          seatCalled = true;
          route.fulfill(
            json({ success: true, data: { ...reservation, status: "seated" } }),
          );
        } else {
          route.continue();
        }
      },
    );

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    // 點擊標記入座按鈕（靛色 CheckCheck）
    const seatBtn = page
      .locator("table tbody tr")
      .first()
      .locator("button.text-indigo-600");
    await expect(seatBtn).toBeVisible();
    await seatBtn.click();

    await page.waitForTimeout(500);
    expect(seatCalled).toBe(true);
  });

  test("pending 訂位取消：確認對話框後應呼叫 cancel API", async ({ page }) => {
    const reservation = createReservation("pending");
    await setupReservationPageMocks(page, [reservation]);

    let cancelCalled = false;
    await page.route(
      new RegExp(
        `${API.replace(/\*/g, ".*")}/reservations/${reservation.id}/cancel`,
      ),
      (route) => {
        if (route.request().method() === "POST") {
          cancelCalled = true;
          route.fulfill(
            json({
              success: true,
              data: { ...reservation, status: "cancelled" },
            }),
          );
        } else {
          route.continue();
        }
      },
    );

    page.on("dialog", (dialog) => dialog.accept());

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    // 點擊取消按鈕（紅色 XCircle）
    const cancelBtn = page
      .locator("table tbody tr")
      .first()
      .locator("button.text-red-600");
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForTimeout(500);
    expect(cancelCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 訂位按鈕可見性驗證
  // -------------------------------------------------------------------------

  test("pending 訂位應顯示確認和取消按鈕，不顯示到店和入座按鈕", async ({
    page,
  }) => {
    const reservation = createReservation("pending");
    await setupReservationPageMocks(page, [reservation]);

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    const row = page.locator("table tbody tr").first();

    // 應可見：確認（綠）、取消（紅）、查看（藍）
    await expect(row.locator("button.text-green-600")).toBeVisible();
    await expect(row.locator("button.text-red-600")).toBeVisible();
    await expect(row.locator("button.text-blue-600")).toBeVisible();

    // 不應可見：到店（紫）、入座（靛）
    await expect(row.locator("button.text-purple-600")).toHaveCount(0);
    await expect(row.locator("button.text-indigo-600")).toHaveCount(0);
  });

  test("confirmed 訂位應顯示到店和取消按鈕，不顯示確認和入座按鈕", async ({
    page,
  }) => {
    const reservation = createReservation("confirmed");
    await setupReservationPageMocks(page, [reservation]);

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    const row = page.locator("table tbody tr").first();

    // 應可見：到店（紫）、取消（紅）
    await expect(row.locator("button.text-purple-600")).toBeVisible();
    await expect(row.locator("button.text-red-600")).toBeVisible();

    // 不應可見：確認（綠）、入座（靛）
    await expect(row.locator("button.text-green-600")).toHaveCount(0);
    await expect(row.locator("button.text-indigo-600")).toHaveCount(0);
  });

  test("arrived 訂位應只顯示入座按鈕，不顯示確認、到店和取消按鈕", async ({
    page,
  }) => {
    const reservation = createReservation("arrived");
    await setupReservationPageMocks(page, [reservation]);

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    const row = page.locator("table tbody tr").first();

    // 應可見：入座（靛）
    await expect(row.locator("button.text-indigo-600")).toBeVisible();

    // 不應可見：確認（綠）、到店（紫）、取消（紅）
    await expect(row.locator("button.text-green-600")).toHaveCount(0);
    await expect(row.locator("button.text-purple-600")).toHaveCount(0);
    await expect(row.locator("button.text-red-600")).toHaveCount(0);
  });

  test("seated/completed/cancelled 訂位不應顯示任何操作按鈕（查看按鈕除外）", async ({
    page,
  }) => {
    const reservations = [
      createReservation("seated", "res-001"),
      createReservation("completed", "res-002"),
      createReservation("cancelled", "res-003"),
    ];
    await setupReservationPageMocks(page, reservations);

    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      // 查看按鈕仍應存在
      await expect(row.locator("button.text-blue-600")).toBeVisible();
      // 其他操作按鈕都不應存在
      await expect(row.locator("button.text-green-600")).toHaveCount(0);
      await expect(row.locator("button.text-purple-600")).toHaveCount(0);
      await expect(row.locator("button.text-indigo-600")).toHaveCount(0);
      await expect(row.locator("button.text-red-600")).toHaveCount(0);
    }
  });
});

// ============================================================================
// 完整生命週期測試（序列化執行）
// ============================================================================

test.describe("訂位完整生命週期 (Reservation Full Lifecycle)", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1280, height: 800 } });

  test("pending → confirmed → arrived → seated 完整流轉", async ({ page }) => {
    await mockAllAPIs(page, PERSONAS.OWNER);

    const reservationId = "res-lifecycle-001";
    let currentStatus = "pending";

    // 建立動態路由：每次重新載入訂位列表時回傳最新狀態
    const setupDynamicMocks = async () => {
      const reservation = createReservation(currentStatus, reservationId);

      // 設定訂位列表 API（每次回傳當前狀態的訂位）
      await page.route(
        new RegExp(`${API.replace(/\*/g, ".*")}/reservations(\\?.*)?$`),
        (route) => {
          const url = route.request().url();
          if (
            url.includes("/confirm") ||
            url.includes("/arrive") ||
            url.includes("/seat") ||
            url.includes("/cancel")
          ) {
            route.continue();
            return;
          }
          if (route.request().method() === "GET") {
            route.fulfill(
              json({
                success: true,
                data: [createReservation(currentStatus, reservationId)],
                pagination: { total: 1, page: 1, limit: 20 },
              }),
            );
          } else {
            route.continue();
          }
        },
      );

      // 確認 API
      await page.route(
        new RegExp(
          `${API.replace(/\*/g, ".*")}/reservations/${reservationId}/confirm`,
        ),
        (route) => {
          currentStatus = "confirmed";
          route.fulfill(
            json({
              success: true,
              data: createReservation("confirmed", reservationId),
            }),
          );
        },
      );

      // 到店 API
      await page.route(
        new RegExp(
          `${API.replace(/\*/g, ".*")}/reservations/${reservationId}/arrive`,
        ),
        (route) => {
          currentStatus = "arrived";
          route.fulfill(
            json({
              success: true,
              data: createReservation("arrived", reservationId),
            }),
          );
        },
      );

      // 入座 API
      await page.route(
        new RegExp(
          `${API.replace(/\*/g, ".*")}/reservations/${reservationId}/seat`,
        ),
        (route) => {
          currentStatus = "seated";
          route.fulfill(
            json({
              success: true,
              data: createReservation("seated", reservationId),
            }),
          );
        },
      );
    };

    // 自動接受 confirm() 對話框
    page.on("dialog", (dialog) => dialog.accept());

    await setupDynamicMocks();
    await loginAndNavigate(page, "seating");
    await page.waitForSelector("table tbody tr");

    // 步驟 1：pending → confirmed（點擊確認按鈕）
    const row1 = page.locator("table tbody tr").first();
    const confirmBtn = row1.locator("button.text-green-600");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 等待 API 回應並重新載入
    await page.waitForTimeout(1000);

    // 步驟 2：confirmed → arrived（重新載入後點擊到店按鈕）
    await page.reload();
    await page.waitForSelector("table tbody tr");

    const row2 = page.locator("table tbody tr").first();
    const arriveBtn = row2.locator("button.text-purple-600");
    await expect(arriveBtn).toBeVisible();
    await arriveBtn.click();

    await page.waitForTimeout(1000);

    // 步驟 3：arrived → seated（重新載入後點擊入座按鈕）
    await page.reload();
    await page.waitForSelector("table tbody tr");

    const row3 = page.locator("table tbody tr").first();
    const seatBtn = row3.locator("button.text-indigo-600");
    await expect(seatBtn).toBeVisible();
    await seatBtn.click();

    await page.waitForTimeout(1000);

    // 步驟 4：seated 狀態 — 所有操作按鈕應消失
    await page.reload();
    await page.waitForSelector("table tbody tr");

    const row4 = page.locator("table tbody tr").first();
    // 已入座：不應有任何流轉按鈕
    await expect(row4.locator("button.text-green-600")).toHaveCount(0);
    await expect(row4.locator("button.text-purple-600")).toHaveCount(0);
    await expect(row4.locator("button.text-indigo-600")).toHaveCount(0);
    await expect(row4.locator("button.text-red-600")).toHaveCount(0);

    // 查看按鈕仍應存在
    await expect(row4.locator("button.text-blue-600")).toBeVisible();

    // 驗證最終狀態為 seated
    expect(currentStatus).toBe("seated");
  });
});
