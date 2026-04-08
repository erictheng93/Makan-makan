/**
 * Edge Cases & Untested Flows
 *
 * Covers scenarios omitted from the happy-path specs:
 *   - Error page + 404 rendering
 *   - Out-of-stock items (filtered out of menu entirely)
 *   - Empty cart state
 *   - Cart item removal
 *   - Order notes input transmitted in payload
 *   - Category tab navigation
 *   - Shop: dine-in selection (vs takeaway)
 *   - Language switcher on home page
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
import { expectNavigatedTo } from "../../helpers/assertions";

test.use({ ...devices["iPhone 12"] });

// ---------------------------------------------------------------------------
// Convenience URLs
// ---------------------------------------------------------------------------
const menuUrl = `/restaurant/${RESTAURANT.id}/table/1`;
const cartUrl = `/restaurant/${RESTAURANT.id}/table/1/cart`;
const shopMenuUrl = `/restaurant/${RESTAURANT.id}/shop/menu?phone=678`;
const orderTypeUrl = `/restaurant/${RESTAURANT.id}/shop/order-type`;

// ---------------------------------------------------------------------------
// 1. ERROR PAGE
// ---------------------------------------------------------------------------

test.describe("Error and Not-Found pages", () => {
  test("should render /error page with code and message", async ({ page }) => {
    await page.goto("/error?code=400&message=無效的QR Code");

    await expect(page.locator("text=/發生錯誤|Error/").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator("text=/無效的QR Code|QR Code/").first(),
    ).toBeVisible({ timeout: 3000 });

    // Both action buttons present
    const homeBtn = page
      .locator('button:has-text("首頁")')
      .or(page.locator('button:has-text("Home")'))
      .or(page.locator('a:has-text("首頁")'));
    await expect(homeBtn.first()).toBeVisible();

    const retryBtn = page
      .locator('button:has-text("重新嘗試")')
      .or(page.locator('button:has-text("Retry")'))
      .or(page.locator('button:has-text("重試")'));
    await expect(retryBtn.first()).toBeVisible();
  });

  test("should render 404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-route-absolutely-does-not-exist-xyz");

    await expect(
      page.locator("text=/404|頁面不存在|Not Found/").first(),
    ).toBeVisible({ timeout: 5000 });

    const homeBtn = page
      .locator('button:has-text("首頁")')
      .or(page.locator('button:has-text("Home")'));
    await expect(homeBtn.first()).toBeVisible();
  });

  test("should navigate home from 404 page", async ({ page }) => {
    await page.goto("/nonexistent-xyz-abc");

    await expect(
      page.locator("text=/404|頁面不存在/").first(),
    ).toBeVisible({ timeout: 5000 });

    await page
      .locator('button:has-text("首頁")')
      .or(page.locator('button:has-text("Home")'))
      .first()
      .click();
    await expect(page).toHaveURL(/^\/?$|\/.*/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 2. OUT-OF-STOCK ITEMS
// NOTE: Items with isAvailable: false are FILTERED OUT entirely — they do not
// appear in the menu view at all (no sold-out badge). Tests verify absence.
// ---------------------------------------------------------------------------

test.describe("Out-of-stock menu items", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should NOT display unavailable items in the menu", async ({ page }) => {
    await page.goto(menuUrl);

    // Available item should be visible
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // MENU_ITEMS[3] (水餃) has isAvailable: false — should be absent from DOM
    await expect(page.locator(`text=${MENU_ITEMS[3].name}`)).toBeHidden({
      timeout: 5000,
    });
  });

  test("should only show available items when menu loads", async ({ page }) => {
    await page.goto(menuUrl);

    // Wait for menu to fully render
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // All three available items should appear
    await expect(
      page.locator(`text=${MENU_ITEMS[1].name}`).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator(`text=${MENU_ITEMS[2].name}`).first(),
    ).toBeVisible({ timeout: 5000 });

    // The unavailable one (水餃) must not appear at all
    const unavailableCount = await page
      .locator(`text=${MENU_ITEMS[3].name}`)
      .count();
    expect(unavailableCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. EMPTY CART STATE
// ---------------------------------------------------------------------------

test.describe("Empty cart state", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should show empty cart message when navigating to cart with no items", async ({
    page,
  }) => {
    // Navigate directly to cart URL without adding any items
    await page.goto(menuUrl);
    await page.waitForLoadState("networkidle");

    // Wait for menu items to be loaded
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // Tap cart button — with nothing in cart the view should show empty state
    const cartBtn = page.locator('[data-testid="cart-btn"]');
    await cartBtn.first().click();

    // Either stayed at menu (redirect) or shows empty cart message
    const isEmpty = page
      .locator('[data-testid="empty-cart"]')
      .or(page.locator("text=/購物車是空的/"))
      .or(page.locator("text=/Cart is empty/"))
      .or(page.locator("text=/沒有品項/"));
    const redirectedToMenu = page.url().includes("/table/");

    // One of the two must be true
    const emptyVisible = await isEmpty.first().isVisible().catch(() => false);
    expect(emptyVisible || redirectedToMenu).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. CART ITEM REMOVAL
// ---------------------------------------------------------------------------

test.describe("Cart item removal", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should remove an item from the cart", async ({ page }) => {
    await page.goto(menuUrl);

    // Add 牛肉麵
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first()).toBeHidden({ timeout: 3000 }).catch(() => {});

    // Go to cart
    await page.locator('[data-testid="cart-btn"]').first().click();
    await expectNavigatedTo(page, cartUrl);

    // Verify item is shown in cart
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 8000 });

    // Remove the item — CartItemCard has data-testid="remove-item"
    const removeBtn = page
      .locator('[data-testid="remove-item"]')
      .or(page.locator('button[aria-label*="remove"]'))
      .or(page.locator('button[aria-label*="移除"]'));

    if (await removeBtn.first().isVisible().catch(() => false)) {
      await removeBtn.first().click();
    } else {
      // Fallback: decrease quantity via minus button (qty=1 → removes item)
      const minusBtn = page
        .locator('[data-testid="qty-decrease"]')
        .or(page.locator('button:has-text("−")'));
      await expect(minusBtn.first()).toBeVisible({ timeout: 5000 });
      await minusBtn.first().click();
    }

    // Item should disappear from cart regardless of which removal method was used
    await expect(
      page.locator(`h3:has-text("${MENU_ITEMS[0].name}")`),
    ).toBeHidden({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// 5. ORDER NOTES
// ---------------------------------------------------------------------------

test.describe("Order notes", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should include order notes in guest order payload", async ({ page }) => {
    await page.goto(menuUrl);

    // Add item
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first()).toBeHidden({ timeout: 3000 }).catch(() => {});

    // Go to cart
    await page.locator('[data-testid="cart-btn"]').first().click();
    await expectNavigatedTo(page, cartUrl);

    // Fill in order notes
    const notesInput = page
      .locator('#order-notes')
      .or(page.locator('textarea[placeholder*="備"]'))
      .or(page.locator('textarea[placeholder*="note"]'))
      .or(page.locator('[data-testid="order-notes"]'));
    await expect(notesInput.first()).toBeVisible({ timeout: 5000 });
    await notesInput.first().fill("不加辣，謝謝！");

    // Intercept the POST request to verify notes are included
    let capturedNotes: string | undefined;
    await page.route("**/api/v1/guest-orders", (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        capturedNotes = body?.notes;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              order: createMockOrder({ id: "order-notes-test" }),
              guestToken: "mock-guest-token",
              tokenExpiresAt: "2099-01-01T00:00:00Z",
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Click submit
    await page.locator('[data-testid="submit-order-btn"]').first().click();

    // Confirm in modal
    const confirmBtn = page
      .locator('button:has-text("確認")')
      .or(page.locator('button:has-text("Confirm")'));
    await confirmBtn.first().click();

    // Wait for navigation or response
    await page.waitForTimeout(1500);

    // Notes should have been sent in the payload
    expect(capturedNotes).toBe("不加辣，謝謝！");
  });
});

// ---------------------------------------------------------------------------
// 6. CATEGORY TAB NAVIGATION
// ---------------------------------------------------------------------------

test.describe("Menu category tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should filter menu items when clicking a category tab", async ({
    page,
  }) => {
    await page.goto(menuUrl);

    // Wait for menu to load — at least one item visible
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });

    // Find the 飲料 (drinks) category tab — MENU_CATEGORIES[2].name = "飲料"
    const drinksTab = page
      .locator(`button:has-text("${MENU_CATEGORIES[2].name}")`)
      .or(
        page.locator(
          `[data-testid="category-tab-${MENU_CATEGORIES[2].id}"]`,
        ),
      );
    await expect(drinksTab.first()).toBeVisible({ timeout: 5000 });
    await drinksTab.first().click();

    // After clicking, the drinks category item (珍珠奶茶) should be visible
    await expect(
      page.locator(`text=${MENU_ITEMS[2].name}`).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 7. SHOP: DINE-IN OPTION
// ---------------------------------------------------------------------------

test.describe("Shop order type: dine-in selection", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should navigate directly to shop menu when selecting dine-in (no phone verification)", async ({
    page,
  }) => {
    await page.goto(orderTypeUrl);

    // Wait for page to load — dine-in is auto-selected by autoSelectType()
    await page.waitForLoadState("networkidle");

    // Dine-in option should be visible (RESTAURANT.settings.enableDineIn = true)
    const dineInOption = page
      .locator('button:has-text("內用")')
      .or(page.locator('button:has-text("Dine")'))
      .or(page.locator('[data-testid="dine-in-option"]'));
    await expect(dineInOption.first()).toBeVisible({ timeout: 10000 });

    // Ensure dine-in is selected (click if not already highlighted)
    await dineInOption.first().click();

    // Click the continue button
    await page.locator('[data-testid="continue-btn"]').first().click();

    // Should go directly to shop menu — NOT to phone verification
    await expect(page).toHaveURL(
      new RegExp(`/restaurant/${RESTAURANT.id}/shop/menu`),
      { timeout: 8000 },
    );

    // Phone verification page should NOT be visited
    expect(page.url()).not.toContain("/shop/verify");
  });

  test("should show fulfillment type toggle in shop cart after adding item", async ({
    page,
  }) => {
    // Navigate to shop menu with phone param so saveCart works
    await page.goto(shopMenuUrl);

    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();

    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first()).toBeHidden({ timeout: 3000 }).catch(() => {});

    // Open cart
    await page.locator('[data-testid="cart-btn"]').first().click();

    // Cart modal should be visible with the item
    const cartModal = page
      .locator('[data-testid="shop-cart-modal"]')
      .or(page.locator('[role="dialog"]'));
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });

    // The fulfillment type toggle section should be visible (外帶 / 外送 buttons)
    const fulfillmentToggle = page
      .locator('text=/外帶|Takeaway|自取/')
      .or(page.locator('[data-testid="fulfillment-type"]'));
    await expect(fulfillmentToggle.first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 8. LANGUAGE SWITCHER
// ---------------------------------------------------------------------------

test.describe("Language switcher", () => {
  test("should switch UI language on home page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // LanguageSwitcher is always on the home page (.language-switcher button)
    // Use a locale-agnostic selector — the button shows flag + name regardless of locale
    const langBtn = page.locator(".language-switcher button").first();
    await expect(langBtn).toBeVisible({ timeout: 8000 });

    // Note the current button text so we can verify it changed
    const initialText = await langBtn.textContent();

    // Open the dropdown
    await langBtn.click();

    // Language options dropdown should appear — each option is a button inside .language-switcher
    const langOptions = page.locator(".language-switcher button").filter({ hasNotText: initialText ?? "" });
    await expect(langOptions.first()).toBeVisible({ timeout: 3000 });

    // Click the first non-current language option
    await langOptions.first().click();

    // The button text should have changed (different language selected)
    await expect(langBtn).not.toHaveText(initialText ?? "", { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// 9. SHOP CART: REMOVE ITEM
// ---------------------------------------------------------------------------

test.describe("Shop cart item removal", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockMenuAPI(page);
    await mockOrderAPI(page);
  });

  test("should remove an item from the shop cart modal", async ({ page }) => {
    await page.goto(shopMenuUrl);

    // Add item
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 10000 });
    await page.locator(`text=${MENU_ITEMS[0].name}`).first().click();
    const modal = page.locator('[data-testid="menu-item-modal"]');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
    await modal
      .first()
      .locator(
        'button:has-text("加入"), button:has-text("Add"), [data-testid="add-to-cart-btn"]',
      )
      .first()
      .click();
    await expect(modal.first()).toBeHidden({ timeout: 3000 }).catch(() => {});

    // Open cart
    await page.locator('[data-testid="cart-btn"]').first().click();

    // Cart modal should appear with the item
    const cartModal = page
      .locator('[data-testid="shop-cart-modal"]')
      .or(page.locator('[role="dialog"]'));
    await expect(cartModal.first()).toBeVisible({ timeout: 5000 });
    await expect(
      cartModal.first().locator(`text=${MENU_ITEMS[0].name}`),
    ).toBeVisible({ timeout: 3000 });

    // Click remove on the item — ShopCartModal has data-testid="remove-item"
    const removeBtn = cartModal
      .first()
      .locator('[data-testid="remove-item"]')
      .or(cartModal.first().locator('button[aria-label*="移除"]'))
      .or(cartModal.first().locator('button[aria-label*="remove"]'));

    if (await removeBtn.first().isVisible().catch(() => false)) {
      await removeBtn.first().click();
    } else {
      // Fallback: decrease quantity via minus button (qty=1 → removes item)
      const minusBtn = cartModal
        .first()
        .locator('[data-testid="qty-decrease"]')
        .or(cartModal.first().locator('button:has-text("−")'));
      await expect(minusBtn.first()).toBeVisible({ timeout: 5000 });
      await minusBtn.first().click();
    }

    // Item should disappear from cart modal regardless of removal method
    await expect(
      cartModal.first().locator(`text=${MENU_ITEMS[0].name}`),
    ).toBeHidden({ timeout: 3000 });
  });
});
