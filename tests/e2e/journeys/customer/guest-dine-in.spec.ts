/**
 * Guest Dine-In Ordering Flow
 *
 * Simulates a walk-in customer scanning a table QR code on their phone
 * and placing a dine-in order without creating an account.
 *
 * Mobile-first: all tests run on iPhone 12 viewport (390x844).
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockMenuAPI,
  mockRestaurantAPI,
  mockTableAPI,
  mockOrderAPI,
  mockAuthAPI,
} from "../../helpers/mock-api";
import {
  RESTAURANT,
  TABLE,
  MENU_ITEMS,
  MENU_CATEGORIES,
  createMockOrder,
  PERSONAS,
} from "../../helpers/personas";
import { expectNavigatedTo, expectCartCount } from "../../helpers/assertions";

// ---------------------------------------------------------------------------
// Mobile viewport for the entire file — this is a phone-first experience
// ---------------------------------------------------------------------------
test.use({ ...devices["iPhone 12"] });

// ---------------------------------------------------------------------------
// Shared setup: mock all APIs the customer app depends on
// ---------------------------------------------------------------------------
test.beforeEach(async ({ page }) => {
  await mockAuthAPI(page, PERSONAS.CUSTOMER);
  await mockRestaurantAPI(page);
  await mockMenuAPI(page);
  await mockTableAPI(page);
  await mockOrderAPI(page);
});

// Convenience selectors
const menuUrl = `/restaurant/${RESTAURANT.id}/table/${TABLE.id}`;
const cartUrl = `${menuUrl}/cart`;

test.describe("Guest dine-in ordering flow", () => {
  // -----------------------------------------------------------------------
  // 1. Home page entry points
  // -----------------------------------------------------------------------

  test("should display home page with scan and manual input options", async ({
    page,
  }) => {
    // Navigate to the customer app home
    await page.goto("/");

    // Verify two primary CTAs are visible: Scan QR and Manual Input
    const scanButton = page.locator(
      'button:has-text("Scan"), button:has-text("掃描"), [data-testid="scan-qr-btn"], a:has-text("Scan"), a:has-text("掃描")',
    );
    const manualButton = page.locator(
      'button:has-text("Manual"), button:has-text("手動"), [data-testid="manual-input-btn"], a:has-text("Manual"), a:has-text("手動")',
    );

    await expect(scanButton.first()).toBeVisible();
    await expect(manualButton.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 2. QR scanner view
  // -----------------------------------------------------------------------

  test("should open QR scanner view", async ({ page }) => {
    await page.goto("/");

    // Tap the scan button
    const scanButton = page.locator(
      'button:has-text("Scan"), button:has-text("掃描"), [data-testid="scan-qr-btn"], a:has-text("Scan"), a:has-text("掃描")',
    );
    await scanButton.first().click();

    // Should navigate to /scan
    await expectNavigatedTo(page, "/scan");
  });

  // -----------------------------------------------------------------------
  // 3. Manual restaurant entry
  // -----------------------------------------------------------------------

  test("should allow manual restaurant entry", async ({ page }) => {
    await page.goto("/");

    // Tap the manual input button (opens ManualInputModal)
    const manualButton = page.locator(
      'button:has-text("手動"), button:has-text("Manual"), [data-testid="manual-input-btn"]',
    );
    await manualButton.first().click();

    // Wait for modal to appear and fill in restaurant name search
    const searchInput = page.locator(
      'input[id="restaurant-name"], input[placeholder*="餐廳"], input[placeholder*="restaurant"]',
    );
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
    await searchInput.first().fill(RESTAURANT.name);

    // Wait for search results dropdown and click the restaurant
    const resultItem = page.locator(
      `button:has-text("${RESTAURANT.name}"), [role="option"]:has-text("${RESTAURANT.name}")`,
    );
    await expect(resultItem.first()).toBeVisible({ timeout: 5000 });
    await resultItem.first().click();

    // Click confirm button
    const confirmBtn = page.locator(
      'button:has-text("確認"), button:has-text("Confirm"), [data-testid="manual-submit-btn"]',
    );
    await confirmBtn.first().click();

    // Should navigate to the shop order-type page
    await expectNavigatedTo(
      page,
      `/restaurant/${RESTAURANT.id}/shop/order-type`,
    );
  });

  // -----------------------------------------------------------------------
  // 4. Menu display with categories
  // -----------------------------------------------------------------------

  test("should display menu with categories", async ({ page }) => {
    // Navigate directly to the menu page (simulating QR scan result)
    await page.goto(menuUrl);

    // Verify category tabs are rendered
    for (const category of MENU_CATEGORIES) {
      const categoryTab = page.locator(
        `[data-testid="category-tab-${category.id}"], [data-testid="category-${category.id}"], button:has-text("${category.name}"), a:has-text("${category.name}")`,
      );
      await expect(categoryTab.first()).toBeVisible();
    }

    // Verify item cards show name and price for available items
    for (const item of MENU_ITEMS.filter((i) => i.isAvailable)) {
      const itemCard = page.locator(`text=${item.name}`);
      await expect(itemCard.first()).toBeVisible();
    }

    // Verify item images are present (at least one img tag in the menu area)
    const menuImages = page.locator("main img[alt]");
    await expect(menuImages.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. Item detail modal
  // -----------------------------------------------------------------------

  test("should open item detail modal on tap", async ({ page }) => {
    await page.goto(menuUrl);

    // Tap on "牛肉麵" item card
    const beefNoodleItem = page.locator(`text=${MENU_ITEMS[0].name}`);
    await beefNoodleItem.first().click();

    // Verify a modal/dialog/sheet/drawer appears
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Verify the modal shows the item description
    await expect(modal.first()).toContainText(MENU_ITEMS[0].description);

    // Verify the modal shows the item price (price is in cents: 18000 = NT$180)
    const priceText = modal.first().locator("text=/180|18,000|18000/");
    await expect(priceText.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 6. Customization selection
  // -----------------------------------------------------------------------

  test("should allow customization selection", async ({ page }) => {
    await page.goto(menuUrl);

    // Open "牛肉麵" detail modal
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();

    // Select size "大" (large, +$30)
    const sizeOption = modal
      .first()
      .locator(
        'button:has-text("大"), label:has-text("大"), [data-testid="size-s2"], input[value="s2"]',
      );
    await sizeOption.first().click();

    // Select spice level "小辣"
    const spiceOption = modal
      .first()
      .locator(
        'button:has-text("小辣"), label:has-text("小辣"), [data-testid="option-o2"], input[value="o2"]',
      );
    await spiceOption.first().click();

    // Add add-on "加蛋" (+$15)
    const addOnOption = modal
      .first()
      .locator(
        'button:has-text("加蛋"), label:has-text("加蛋"), [data-testid="addon-a1"], input[value="a1"]',
      );
    await addOnOption.first().click();

    // Verify the price updated to reflect customizations
    // Base 180 + size 30 + add-on 15 = 225 (or 22500 in cents)
    const updatedPrice = modal.first().locator("text=/225|22,500|22500/");
    await expect(updatedPrice.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 7. Add item to cart and verify badge
  // -----------------------------------------------------------------------

  test("should add item to cart and show badge", async ({ page }) => {
    await page.goto(menuUrl);

    // Open "牛肉麵" detail and add to cart
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();

    // Click the add-to-cart button inside the modal
    const addToCartBtn = modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), button:has-text("加入購物車"), [data-testid="add-to-cart-btn"]',
      );
    await addToCartBtn.first().click();

    // Verify cart badge shows 1
    await expectCartCount(page, 1);
  });

  // -----------------------------------------------------------------------
  // 8. Add multiple items to cart
  // -----------------------------------------------------------------------

  test("should add multiple items to cart", async ({ page }) => {
    await page.goto(menuUrl);

    // Add "牛肉麵" x1 via the modal
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();

    const addToCartBtn = modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), button:has-text("加入購物車"), [data-testid="add-to-cart-btn"]',
      );
    await addToCartBtn.first().click();

    // Wait for modal to close
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Add "珍珠奶茶" — tap it to open detail, then increase quantity to 2 before adding
    await page.locator(`text=${MENU_ITEMS[2].name}`).first().click();
    await expect(modal.first()).toBeVisible();

    // Increase quantity to 2 inside the modal (look for + button or quantity stepper)
    const plusBtn = modal
      .first()
      .locator(
        'button:has-text("+"), [data-testid="qty-increase"], [data-testid="quantity-plus"], [aria-label="increase"], [aria-label="Increase"]',
      );
    await plusBtn.first().click(); // quantity goes from 1 to 2

    // Add to cart
    const addBtn = modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), button:has-text("加入購物車"), [data-testid="add-to-cart-btn"]',
      );
    await addBtn.first().click();

    // Total items in cart: 1 (beef noodle) + 2 (bubble tea) = 3
    await expectCartCount(page, 3);
  });

  // -----------------------------------------------------------------------
  // 9. Cart displays correct items and subtotal
  // -----------------------------------------------------------------------

  test("should display cart with correct items and subtotal", async ({
    page,
  }) => {
    await page.goto(menuUrl);

    // Add "牛肉麵" x1
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Add "珍珠奶茶" x1
    await page.locator(`text=${MENU_ITEMS[2].name}`).first().click();
    await expect(modal.first()).toBeVisible();
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Navigate to the cart page
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();
    await expectNavigatedTo(page, cartUrl);

    // Verify both items appear in the cart
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`text=${MENU_ITEMS[2].name}`).first(),
    ).toBeVisible();

    // Verify subtotal is displayed (180 + 60 = 240, or NT$240)
    const subtotal = page.locator("text=/240|24,000|NT\\$\\s*240/");
    await expect(subtotal.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 10. Quantity update in cart
  // -----------------------------------------------------------------------

  test("should allow quantity update in cart", async ({ page }) => {
    await page.goto(menuUrl);

    // Add "珍珠奶茶" x1
    await page.locator(`text=${MENU_ITEMS[2].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Navigate to cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();
    await expectNavigatedTo(page, cartUrl);

    // Increase "珍珠奶茶" quantity from 1 to 3 (click + twice)
    const teaRow = page
      .locator(`text=${MENU_ITEMS[2].name}`)
      .first()
      .locator("..");
    const plusBtn = teaRow
      .locator(
        'button:has-text("+"), [data-testid="qty-increase"], [aria-label="increase"], [aria-label="Increase"]',
      )
      .or(page.locator('[data-testid="qty-increase"]').first());
    await plusBtn.first().click();
    await plusBtn.first().click();

    // Subtotal should update to 60 * 3 = 180 (or NT$180)
    const subtotal = page.locator("text=/180|18,000|NT\\$\\s*180/");
    await expect(subtotal.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 11. Submit order and redirect to tracking
  // -----------------------------------------------------------------------

  test("should submit order and redirect to tracking", async ({ page }) => {
    await page.goto(menuUrl);

    // Add "牛肉麵" x1
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible();
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first())
      .toBeHidden({ timeout: 3000 })
      .catch(() => {});

    // Go to cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();
    await expectNavigatedTo(page, cartUrl);

    // Click the submit/place order button (opens ConfirmationModal)
    const submitBtn = page.locator(
      'button:has-text("送出"), button:has-text("Submit"), button:has-text("下單"), [data-testid="submit-order-btn"], [data-testid="place-order-btn"]',
    );
    await submitBtn.first().click();

    // Confirm the order in the confirmation dialog
    const confirmBtn = page.locator(
      '[data-testid="shop-cart-modal"] button:has-text("確認"), [data-testid="confirmation-modal"] button:has-text("確認"), button:has-text("確認"), button:has-text("Confirm")',
    );
    await confirmBtn.first().click();

    // Verify redirect to the order tracking page
    // The mock returns order id "order-guest" from the guest endpoint
    await expectNavigatedTo(
      page,
      `/restaurant/${RESTAURANT.id}/table/${TABLE.id}/order/`,
    );

    // Verify the order number is displayed on the tracking page
    const orderNumber = page
      .locator("text=/ORD-/")
      .or(page.locator('[data-testid="order-number"]'));
    await expect(orderNumber.first()).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // 12. Order status timeline
  // -----------------------------------------------------------------------

  test("should show order status timeline", async ({ page }) => {
    const order = createMockOrder({ status: 0 });

    // Navigate directly to the order tracking page
    await page.goto(`${menuUrl}/order/${order.id}`);

    // Verify the "pending" / "等待確認" status is shown
    const statusIndicator = page
      .locator(
        '[data-testid="order-status"], [data-status], .order-status, .status-badge',
      )
      .or(page.locator("text=/等待|處理中|已送出|pending/"));
    await expect(statusIndicator.first()).toBeVisible({ timeout: 10000 });

    // Verify a timeline or step indicator is rendered
    const timeline = page.locator(
      '[data-testid="order-timeline"], [data-testid="status-timeline"], .timeline, .stepper, [class*="timeline"], [class*="stepper"], [class*="progress"]',
    );
    await expect(timeline.first()).toBeVisible();

    // Simulate a status update by re-mocking the order endpoint with an advanced status
    const updatedOrder = createMockOrder({ status: 2 }); // status 2 = preparing / 準備中
    await page.route(new RegExp(`/api/v1/orders/${order.id}$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: updatedOrder }),
        });
      } else {
        route.continue();
      }
    });

    // Trigger a refresh — either the app polls automatically or we reload
    await page.reload();

    // Verify the timeline now shows the advanced status
    const advancedStatus = page.locator(
      "text=/preparing|準備中|製作中|confirmed|已確認/",
    );
    await expect(advancedStatus.first()).toBeVisible({ timeout: 10000 });
  });
});
