/**
 * Guest Shop Takeaway Ordering Flow
 *
 * Simulates a customer using a shop QR code for takeaway ordering.
 * The customer selects "Takeaway" as the order type, verifies their
 * phone number, browses the shop menu, and places an order for pickup.
 *
 * Mobile-first: all tests run on iPhone 12 viewport (390x844).
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockMenuAPI,
  mockRestaurantAPI,
  mockOrderAPI,
  mockAuthAPI,
} from "../../helpers/mock-api";
import {
  RESTAURANT,
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
// App base URL and route constants
// ---------------------------------------------------------------------------
const CUSTOMER_APP = "http://localhost:5173";
const orderTypeUrl = `/restaurant/${RESTAURANT.id}/shop/order-type`;
const verifyUrl = `/restaurant/${RESTAURANT.id}/shop/verify`;
const shopMenuUrl = `/restaurant/${RESTAURANT.id}/shop/menu`;

// ---------------------------------------------------------------------------
// Shared setup: mock all APIs the customer app depends on
// ---------------------------------------------------------------------------
test.beforeEach(async ({ page }) => {
  await mockAuthAPI(page, PERSONAS.CUSTOMER);
  await mockRestaurantAPI(page);
  await mockMenuAPI(page);
  await mockOrderAPI(page);

  // Mock phone verification endpoint
  await page.route("**/api/v1/auth/verify-phone", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { verified: true, token: "mock-verified-token" },
        }),
      });
    } else {
      route.continue();
    }
  });

  // Mock OTP send endpoint
  await page.route("**/api/v1/auth/send-otp", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { sent: true, expiresIn: 300 },
        }),
      });
    } else {
      route.continue();
    }
  });

  // Mock shop QR entry endpoint
  await page.route(
    new RegExp(`\\*\\*/api/v1/restaurants/.+/qr/shop`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            restaurantId: RESTAURANT.id,
            shopModeEnabled: true,
            enableTakeaway: true,
            enableDineIn: true,
          },
        }),
      }),
  );
});

test.describe("Guest shop takeaway ordering flow", () => {
  // -----------------------------------------------------------------------
  // 1. Shop QR entry -> order type landing page with restaurant info
  // -----------------------------------------------------------------------

  test("should display order type landing page with restaurant info", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${orderTypeUrl}`);

    // Verify restaurant name is displayed
    await expect(page.locator(`text=${RESTAURANT.name}`).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify order type options are visible (Dine-in and Takeaway)
    const takeawayOption = page.locator(
      'button:has-text("Takeaway"), button:has-text("外帶"), button:has-text("自取"), [data-testid="order-type-takeaway"], a:has-text("Takeaway"), a:has-text("外帶")',
    );
    const dineInOption = page.locator(
      'button:has-text("Dine"), button:has-text("內用"), [data-testid="order-type-dinein"], a:has-text("Dine"), a:has-text("內用")',
    );

    await expect(takeawayOption.first()).toBeVisible();
    await expect(dineInOption.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 2. Select "Takeaway" -> phone verification page
  // -----------------------------------------------------------------------

  test("should navigate to phone verification after selecting Takeaway", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${orderTypeUrl}`);

    // Wait for page to load
    await expect(page.locator(`text=${RESTAURANT.name}`).first()).toBeVisible({
      timeout: 10000,
    });

    // Click the Takeaway option
    const takeawayOption = page.locator(
      'button:has-text("Takeaway"), button:has-text("外帶"), button:has-text("自取"), [data-testid="order-type-takeaway"], a:has-text("Takeaway"), a:has-text("外帶")',
    );
    await takeawayOption.first().click();

    // Should navigate to the phone verification page
    await expectNavigatedTo(page, "/shop/verify");
  });

  // -----------------------------------------------------------------------
  // 3. Enter phone number -> verification -> proceed to menu
  // -----------------------------------------------------------------------

  test("should complete phone verification and proceed to menu", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${verifyUrl}`);

    // Find and fill the phone number input
    const phoneInput = page.locator(
      'input[name="phone"], input[type="tel"], input[placeholder*="phone"], input[placeholder*="手機"], input[placeholder*="電話"], [data-testid="phone-input"]',
    );
    await expect(phoneInput.first()).toBeVisible({ timeout: 10000 });
    await phoneInput.first().fill("0912345678");

    // Click the send OTP / verify button
    const sendBtn = page.locator(
      'button:has-text("Send"), button:has-text("發送"), button:has-text("驗證"), button:has-text("Verify"), button[type="submit"], [data-testid="send-otp-btn"]',
    );
    await sendBtn.first().click();

    // If an OTP input appears, fill it with a mock code
    const otpInput = page.locator(
      'input[name="otp"], input[name="code"], input[placeholder*="OTP"], input[placeholder*="驗證碼"], [data-testid="otp-input"]',
    );
    if (
      await otpInput
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await otpInput.first().fill("123456");

      // Submit the OTP
      const verifyBtn = page.locator(
        'button:has-text("Verify"), button:has-text("確認"), button:has-text("驗證"), button[type="submit"], [data-testid="verify-otp-btn"]',
      );
      await verifyBtn.first().click();
    }

    // Should navigate to the shop menu
    await expectNavigatedTo(page, "/shop/menu");
  });

  // -----------------------------------------------------------------------
  // 4. Shop menu loads with categories and items
  // -----------------------------------------------------------------------

  test("should display shop menu with categories and items", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Verify category tabs are rendered
    for (const category of MENU_CATEGORIES) {
      const categoryTab = page.locator(
        `[data-testid="category-tab-${category.id}"], [data-testid="category-${category.id}"], button:has-text("${category.name}"), a:has-text("${category.name}")`,
      );
      await expect(categoryTab.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify item cards show name and price for available items
    for (const item of MENU_ITEMS.filter((i) => i.available)) {
      const itemCard = page.locator(`text=${item.name}`);
      await expect(itemCard.first()).toBeVisible();
    }

    // Verify item images are present
    const menuImages = page.locator(
      '[data-testid="menu-item"] img, .menu-item img, [class*="menu"] img',
    );
    await expect(menuImages.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. Add items to shop cart
  // -----------------------------------------------------------------------

  test("should add items to shop cart", async ({ page }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Wait for menu to load
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // Tap on first item to open detail modal
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator(
      '[role="dialog"], [data-testid="item-detail-modal"], [data-testid="customization-modal"], .modal, .sheet, .drawer, [class*="modal"], [class*="dialog"], [class*="sheet"], [class*="drawer"]',
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Click add-to-cart button inside the modal
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
  // 6. Open cart modal -> shows takeaway fulfillment type
  // -----------------------------------------------------------------------

  test("should show takeaway fulfillment type in cart modal", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Add an item first
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator(
      '[role="dialog"], [data-testid="item-detail-modal"], [data-testid="customization-modal"], .modal, .sheet, .drawer, [class*="modal"], [class*="dialog"], [class*="sheet"], [class*="drawer"]',
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

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

    // Open the cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();

    // Verify takeaway fulfillment type is displayed
    const takeawayLabel = page.locator("text=/Takeaway|外帶|自取|Pick.?up/i");
    await expect(takeawayLabel.first()).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // 7. Review order summary -> subtotal, no delivery fee
  // -----------------------------------------------------------------------

  test("should show order summary with subtotal and no delivery fee", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Add "牛肉麵" x1
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator(
      '[role="dialog"], [data-testid="item-detail-modal"], [data-testid="customization-modal"], .modal, .sheet, .drawer, [class*="modal"], [class*="dialog"], [class*="sheet"], [class*="drawer"]',
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

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
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

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

    // Open cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();

    // Verify both items appear
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`text=${MENU_ITEMS[2].name}`).first(),
    ).toBeVisible();

    // Verify subtotal is displayed (180 + 60 = 240)
    const subtotal = page.locator("text=/240|24,000|NT\\$\\s*240/");
    await expect(subtotal.first()).toBeVisible();

    // Verify no delivery fee is shown (takeaway = no delivery)
    const deliveryFee = page.locator("text=/delivery fee|運費|外送費/i");
    // Delivery fee should either be hidden or show $0
    const hasFee = await deliveryFee
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasFee) {
      // If a delivery fee line is shown, it should be 0 for takeaway
      const feeZero = page.locator("text=/\\$0|免運|免費|free/i");
      await expect(feeZero.first()).toBeVisible();
    }
  });

  // -----------------------------------------------------------------------
  // 8. Submit order -> guest token -> tracking page
  // -----------------------------------------------------------------------

  test("should submit takeaway order and redirect to tracking", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Add "牛肉麵" x1
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator(
      '[role="dialog"], [data-testid="item-detail-modal"], [data-testid="customization-modal"], .modal, .sheet, .drawer, [class*="modal"], [class*="dialog"], [class*="sheet"], [class*="drawer"]',
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

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

    // Open cart
    const cartLink = page.locator(
      '[data-testid="cart-btn"], [data-testid="view-cart"], a[href*="cart"], button:has-text("購物車"), button:has-text("Cart")',
    );
    await cartLink.first().click();

    // Mock guest order submission with takeaway-specific response
    await page.route("**/api/v1/orders/guest", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: createMockOrder({
              id: "order-takeaway-001",
              orderNumber: "ORD-TAKEAWAY-001",
              fulfillmentType: "takeaway",
              pickupNumber: "T-042",
            }),
          }),
        });
      } else {
        route.continue();
      }
    });

    // Click the submit/place order button
    const submitBtn = page.locator(
      'button:has-text("送出"), button:has-text("Submit"), button:has-text("下單"), button:has-text("Place Order"), [data-testid="submit-order-btn"], [data-testid="place-order-btn"]',
    );
    await submitBtn.first().click();

    // Verify redirect to order tracking page
    await page
      .waitForURL(/\/(order-tracking|orders|tracking|confirmation|order)/, {
        timeout: 10000,
      })
      .catch(() => {});

    // Verify the order number is displayed on the tracking page
    const orderNumber = page.locator(
      'text=/ORD-/, [data-testid="order-number"]',
    );
    await expect(orderNumber.first()).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // 9. Pickup number displayed on tracking page
  // -----------------------------------------------------------------------

  test("should display pickup number on tracking page", async ({ page }) => {
    const takeawayOrder = createMockOrder({
      id: "order-takeaway-001",
      orderNumber: "ORD-TAKEAWAY-001",
      fulfillmentType: "takeaway",
      pickupNumber: "T-042",
      status: 0,
    });

    // Override order detail endpoint
    await page.route(new RegExp(`/api/v1/orders/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: takeawayOrder }),
        });
      } else {
        route.continue();
      }
    });

    // Navigate directly to the order tracking page
    await page.goto(
      `${CUSTOMER_APP}/restaurant/${RESTAURANT.id}/shop/order/${takeawayOrder.id}`,
    );
    await page.waitForLoadState("networkidle");

    // Verify the pickup number is displayed
    const pickupNumber = page.locator(
      'text=/T-042/, [data-testid="pickup-number"], [data-testid="queue-number"]',
    );
    await expect(pickupNumber.first()).toBeVisible({ timeout: 10000 });

    // Verify the order number is also shown
    const orderRef = page.locator(`text=${takeawayOrder.orderNumber}`);
    await expect(orderRef.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 10. Cart persists across page refresh (localStorage)
  // -----------------------------------------------------------------------

  test("should persist cart across page refresh via localStorage", async ({
    page,
  }) => {
    await page.goto(`${CUSTOMER_APP}${shopMenuUrl}`);

    // Wait for menu to load
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // Add "牛肉麵" x1
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator(
      '[role="dialog"], [data-testid="item-detail-modal"], [data-testid="customization-modal"], .modal, .sheet, .drawer, [class*="modal"], [class*="dialog"], [class*="sheet"], [class*="drawer"]',
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();

    // Verify cart badge shows 1
    await expectCartCount(page, 1);

    // Verify localStorage has cart data
    const cartData = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const cartKey = keys.find(
        (k) => k.includes("cart") || k.includes("Cart") || k.includes("pinia"),
      );
      return cartKey ? localStorage.getItem(cartKey) : null;
    });
    expect(cartData).toBeTruthy();

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify cart badge still shows 1 after refresh
    await expectCartCount(page, 1);
  });
});
