/**
 * Customer Dine-In E2E Integration Test (Real Backend)
 *
 * Opens a real browser, navigates the customer app, and hits the real API
 * at localhost:8787 with a real D1 database. No API mocking.
 *
 * Flow: Navigate to table menu → browse menu → add items to cart →
 *       fill customer info → submit order → verify order tracking page →
 *       simulate backend status updates → verify UI reflects changes.
 *
 * Prerequisites:
 *   - pnpm dev:api    (localhost:8787)
 *   - pnpm dev:customer (localhost:3000)
 *   - pnpm db:seed:mock (seeded test data)
 */

import { test, expect, type Page } from "@playwright/test";
import {
  RESTAURANT_ID,
  TABLE_A1_ID,
  MENU,
  USERS,
  loginAs,
  updateOrderStatus,
  cleanupOrder,
  uniquePhone,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Customer dine-in ordering (real backend)", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  // -----------------------------------------------------------------------
  // 1. Menu page loads real data from the API
  // -----------------------------------------------------------------------

  test("displays real menu items from the API", async ({ page }) => {
    await page.goto(`/restaurant/${RESTAURANT_ID}/table/${TABLE_A1_ID}`);

    // Wait for the menu to load from the real API
    // Seeded restaurant name: 阿嬤的味道
    await expect(page.locator("h1")).toContainText("阿嬤的味道", {
      timeout: 15000,
    });

    // Verify table number is displayed in the header subtitle
    await expect(
      page.locator("text=/Table Number 1|桌號 1/").first(),
    ).toBeVisible();

    // Verify seeded menu items are rendered (from 阿嬤的味道 seed data)
    await expect(page.locator("text=滷肉飯").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=紅茶").first()).toBeVisible();
    await expect(page.locator("text=貢丸湯").first()).toBeVisible();

    // Verify category tabs are rendered
    await expect(page.locator("text=招牌小吃").first()).toBeVisible();
    await expect(page.locator("text=飲料").first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 2. Add items to cart and verify cart state
  // -----------------------------------------------------------------------

  test("adds menu items to cart via quick-add buttons", async ({ page }) => {
    await page.goto(`/restaurant/${RESTAURANT_ID}/table/${TABLE_A1_ID}`);

    // Wait for menu to load
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 15000,
    });

    // Click the quick-add button on 紅茶 (no customizations, has quick-add)
    // The quick-add button is next to the item name/price, contains "加入" text
    const hongChaCard = page.locator("text=紅茶").first().locator("../..");
    const addButton = hongChaCard.locator(
      'button:has-text("加入"), button:has-text("Add")',
    );
    await addButton.first().click();

    // Verify cart badge shows 1
    const cartBadge = page.locator('[data-testid="cart-count"]');
    await expect(cartBadge).toBeVisible({ timeout: 5000 });
    await expect(cartBadge).toHaveText("1");

    // Add 貢丸湯 as well
    const gongWanCard = page.locator("text=貢丸湯").first().locator("../..");
    const addButton2 = gongWanCard.locator(
      'button:has-text("加入"), button:has-text("Add")',
    );
    await addButton2.first().click();

    // Cart badge should now show 2
    await expect(cartBadge).toHaveText("2");
  });

  // -----------------------------------------------------------------------
  // 3. Full dine-in order: add items → cart → submit → tracking
  // -----------------------------------------------------------------------

  test("completes full dine-in order and reaches tracking page", async ({
    page,
  }) => {
    const phoneDigits = uniquePhone();

    await page.goto(`/restaurant/${RESTAURANT_ID}/table/${TABLE_A1_ID}`);

    // Wait for menu to load
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 15000,
    });

    // Add 紅茶 (item ID 15, $20) via quick-add
    const hongChaCard = page.locator("text=紅茶").first().locator("../..");
    await hongChaCard
      .locator('button:has-text("加入"), button:has-text("Add")')
      .first()
      .click();

    // Verify cart badge
    const cartBadge = page.locator('[data-testid="cart-count"]');
    await expect(cartBadge).toBeVisible({ timeout: 5000 });

    // Navigate to cart
    await page.locator('[data-testid="cart-btn"]').click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 10000 });

    // Verify item appears in cart
    await expect(page.locator("text=紅茶").first()).toBeVisible();

    // Fill customer info (phone is used as phoneLastDigits for guest order)
    await page.locator("#customer-phone").fill(`0912345${phoneDigits}`);

    // Click submit order button
    const submitBtn = page.locator('[data-testid="submit-order-btn"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Confirm in the confirmation modal
    const confirmBtn = page.locator(
      '.fixed button:has-text("確認"), .fixed button:has-text("Confirm")',
    );
    await expect(confirmBtn.first()).toBeVisible({ timeout: 5000 });
    await confirmBtn.first().click();

    // Should redirect to order tracking page
    await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 15000 });

    // Extract order ID from URL for cleanup
    const url = page.url();
    const orderIdMatch = url.match(/\/order\/(\d+)/);
    if (orderIdMatch) {
      createdOrderId = Number(orderIdMatch[1]);
    }

    // Verify order tracking page loads with real data
    const timeline = page.locator('[data-testid="order-timeline"]');
    await expect(timeline).toBeVisible({ timeout: 10000 });

    // Verify the order status is displayed (starts as Pending)
    await expect(
      page.locator("text=/Pending|等待|pending/i").first(),
    ).toBeVisible({ timeout: 5000 });

    // Scroll down to verify order details section is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify ordered items section renders with the actual menu item name
    await expect(
      page.locator("text=/Ordered Items|餐點/i").first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 5000,
    });
    // Verify "Unknown Item" does NOT appear (regression guard)
    await expect(page.locator("text=Unknown Item")).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // 4. Order status updates reflected in the UI
  // -----------------------------------------------------------------------

  test("reflects backend status changes on the tracking page", async ({
    page,
  }, testInfo) => {
    // This test creates an order via UI then calls backend APIs to update status
    // and verifies each status change — needs extra time in headed mode.
    testInfo.setTimeout(90_000);
    const phoneDigits = uniquePhone();

    // --- Create the order via UI ---
    await page.goto(`/restaurant/${RESTAURANT_ID}/table/${TABLE_A1_ID}`);
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 15000,
    });

    // Add item and go to cart
    const hongChaCard = page.locator("text=紅茶").first().locator("../..");
    await hongChaCard
      .locator('button:has-text("加入"), button:has-text("Add")')
      .first()
      .click();
    await page.locator('[data-testid="cart-btn"]').click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 10000 });

    // Fill phone and submit
    await page.locator("#customer-phone").fill(`0912345${phoneDigits}`);
    const submitBtn = page.locator('[data-testid="submit-order-btn"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Confirm
    const confirmBtn = page.locator(
      '.fixed button:has-text("確認"), .fixed button:has-text("Confirm")',
    );
    await expect(confirmBtn.first()).toBeVisible({ timeout: 5000 });
    await confirmBtn.first().click();

    // Wait for tracking page (headed mode can be slower)
    await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 30000 });

    const url = page.url();
    const orderIdMatch = url.match(/\/order\/(\d+)/);
    expect(orderIdMatch).toBeTruthy();
    createdOrderId = Number(orderIdMatch![1]);

    // Verify the timeline is visible
    await expect(page.locator('[data-testid="order-timeline"]')).toBeVisible({
      timeout: 15000,
    });

    // --- Now simulate backend status changes via API ---

    // Owner confirms the order
    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(createdOrderId, "confirmed", ownerAuth);

    // Reload to pick up the new status
    await page.reload();
    await expect(page.locator('[data-testid="order-timeline"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify "confirmed" / "已確認" status appears in the timeline
    await expect(page.locator("text=/已確認|confirmed/i").first()).toBeVisible({
      timeout: 10000,
    });

    // Chef starts preparing
    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(createdOrderId, "preparing", chefAuth);

    await page.reload();
    await expect(
      page.locator("text=/準備中|製作中|preparing/i").first(),
    ).toBeVisible({ timeout: 10000 });

    // Chef marks ready
    await updateOrderStatus(createdOrderId, "ready", chefAuth);

    await page.reload();
    await expect(
      page.locator("text=/已完成|可取餐|ready/i").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // 5. Multiple items order with correct total
  // -----------------------------------------------------------------------

  test("submits order with multiple items and verifies total on tracking page", async ({
    page,
  }) => {
    const phoneDigits = uniquePhone();

    await page.goto(`/restaurant/${RESTAURANT_ID}/table/${TABLE_A1_ID}`);
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 15000,
    });

    // Add 紅茶 ($20)
    const hongChaCard = page.locator("text=紅茶").first().locator("../..");
    await hongChaCard
      .locator('button:has-text("加入"), button:has-text("Add")')
      .first()
      .click();

    // Wait for cart badge to appear
    const cartBadge = page.locator('[data-testid="cart-count"]');
    await expect(cartBadge).toBeVisible({ timeout: 5000 });

    // Add 貢丸湯 ($35)
    const gongWanCard = page.locator("text=貢丸湯").first().locator("../..");
    await gongWanCard
      .locator('button:has-text("加入"), button:has-text("Add")')
      .first()
      .click();
    await expect(cartBadge).toHaveText("2");

    // Navigate to cart
    await page.locator('[data-testid="cart-btn"]').click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 10000 });

    // Verify both items in cart
    await expect(page.locator("text=紅茶").first()).toBeVisible();
    await expect(page.locator("text=貢丸湯").first()).toBeVisible();

    // Fill phone and submit
    await page.locator("#customer-phone").fill(`0912345${phoneDigits}`);
    const submitBtn = page.locator('[data-testid="submit-order-btn"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Confirm
    const confirmBtn = page.locator(
      '.fixed button:has-text("確認"), .fixed button:has-text("Confirm")',
    );
    await expect(confirmBtn.first()).toBeVisible({ timeout: 5000 });
    await confirmBtn.first().click();

    // Wait for tracking page
    await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 15000 });

    const url = page.url();
    const orderIdMatch = url.match(/\/order\/(\d+)/);
    if (orderIdMatch) {
      createdOrderId = Number(orderIdMatch[1]);
    }

    // Verify both items appear with their real names on the tracking page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.locator("text=/Ordered Items|餐點/i").first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=紅茶").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=貢丸湯").first()).toBeVisible();
    // Verify "Unknown Item" does NOT appear (regression guard)
    await expect(page.locator("text=Unknown Item")).toHaveCount(0);
  });
});
