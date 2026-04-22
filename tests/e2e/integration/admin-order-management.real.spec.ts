/**
 * Admin Dashboard Order Management E2E Integration Test (Real Backend)
 *
 * Opens the real admin dashboard in a real browser and verifies that the
 * owner-facing order management page reads and mutates real API data at
 * localhost:8787.
 *
 * No API mocking.
 *
 * Prerequisites:
 *   - pnpm dev:api      (localhost:8787)
 *   - pnpm dev:admin    (localhost:3001)
 *   - pnpm db:seed:mock
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  USERS,
  createGuestOrder,
  cleanupOrder,
} from "./helpers";

const ADMIN_APP = process.env.E2E_ADMIN_URL || "http://localhost:3001";

function adminOrderNumber(orderId: number): string {
  return `ORD-${String(orderId).padStart(6, "0")}`;
}

async function loginToAdmin(page: import("@playwright/test").Page) {
  await page.goto(`${ADMIN_APP}/login`);
  await page.locator("#username").fill(USERS.OWNER);
  await page.locator("#password").fill("password123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard\/owner-overview$/, {
    timeout: 15000,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Admin order management (real backend)", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("owner can see a newly created guest order on the real orders page", async ({
    page,
  }) => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      {
        orderType: "table",
        tableId: 1,
        guestName: "Admin E2E Guest",
      },
    );
    createdOrderId = created.data.order.id;
    const expectedOrderNumber = adminOrderNumber(createdOrderId);

    await loginToAdmin(page);
    await page.goto(`${ADMIN_APP}/dashboard/orders`);

    await expect(page.locator(".orders-view")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("h2")).toContainText(/訂單列表|Order List/i);

    const desktopTable = page.locator(".hidden.lg\\:block");
    const orderCell = desktopTable
      .locator(`text=${expectedOrderNumber}`)
      .first();
    await expect(orderCell).toBeVisible({ timeout: 15000 });

    const row = orderCell.locator(
      "xpath=ancestor::div[contains(@class,'grid')][1]",
    );
    await expect(row).toContainText("Admin E2E Guest");
    await expect(row).toContainText(/待處理|Pending/i);
  });

  test("owner can move a real order from pending to confirmed from the orders page", async ({
    page,
  }) => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.DONG_GUA_CHA, quantity: 1 }],
      {
        orderType: "table",
        tableId: 1,
        guestName: "Status E2E Guest",
      },
    );
    createdOrderId = created.data.order.id;
    const expectedOrderNumber = adminOrderNumber(createdOrderId);

    await loginToAdmin(page);
    await page.goto(`${ADMIN_APP}/dashboard/orders`);

    await expect(page.locator(".orders-view")).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(`text=${expectedOrderNumber}`).first(),
    ).toBeVisible({ timeout: 15000 });

    const desktopTable = page.locator(".hidden.lg\\:block");
    const orderCell = desktopTable
      .locator(`text=${expectedOrderNumber}`)
      .first();
    await expect(orderCell).toBeVisible();

    const row = orderCell.locator(
      "xpath=ancestor::div[contains(@class,'grid')][1]",
    );
    await expect(row).toContainText(/待處理|Pending/i);

    const updateButton = row.locator("button.text-green-600").first();
    await expect(updateButton).toBeVisible();
    await updateButton.click();

    await expect(row).toContainText(/已確認|Confirmed/i, {
      timeout: 15000,
    });
  });
});
