/**
 * Auth Guard — Customer App Route Protection
 *
 * Verifies that the Vue router's navigation guard correctly:
 *   A. Redirects unauthenticated users from /orders to /login
 *   B. Redirects unauthenticated users from /profile to /login
 *   C. Preserves the original path in the `redirect` query param
 *   D. Allows authenticated users to access order history after login
 *
 * Auth state:
 *   - authStore.isAuthenticated = computed(() => !!user.value && !!token.value)
 *   - token initialised from localStorage.getItem("customer_auth_token")
 *   - user.value starts as null — guard fires immediately on navigation
 *
 * Mobile-first: all tests run on iPhone 12 viewport (390x844).
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockAuthAPI,
} from "../../helpers/mock-api";
import { PERSONAS, createMockOrder } from "../../helpers/personas";

// ---------------------------------------------------------------------------
// Mobile viewport for the entire file
// ---------------------------------------------------------------------------
test.use({ ...devices["iPhone 12"] });

const API_RE = "/api/v1";

// ---------------------------------------------------------------------------
// A. Unauthenticated: /orders → redirect to /login
// ---------------------------------------------------------------------------

test.describe("A. Route guard: /orders without auth", () => {
  test("should redirect to /login when accessing /orders without auth", async ({
    page,
  }) => {
    // No auth setup — user.value=null, token.value=null → isAuthenticated=false
    await page.goto("/orders");

    // Should land on a /login path
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    // Login form fields should be present
    const usernameInput = page
      .locator("#username")
      .or(page.locator('input[name="username"]'))
      .or(page.locator('input[type="text"]'));
    await expect(usernameInput.first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// B. Unauthenticated: /profile → redirect to /login
// ---------------------------------------------------------------------------

test.describe("B. Route guard: /profile without auth", () => {
  test("should redirect to /login when accessing /profile without auth", async ({
    page,
  }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// C. Redirect URL is preserved after guard intercept
// ---------------------------------------------------------------------------

test.describe("C. Redirect query param preservation", () => {
  test("should include redirect param containing 'orders' in login URL", async ({
    page,
  }) => {
    await page.goto("/orders");

    // Wait for redirect
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    // The full URL should contain a `redirect` query param that points to /orders
    const url = new URL(page.url());
    const redirectParam = url.searchParams.get("redirect");

    expect(redirectParam).toBeTruthy();
    expect(redirectParam).toContain("orders");
  });

  test("should include redirect param when accessing /profile without auth", async ({
    page,
  }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

    const url = new URL(page.url());
    const redirectParam = url.searchParams.get("redirect");

    expect(redirectParam).toBeTruthy();
    expect(redirectParam).toContain("profile");
  });
});

// ---------------------------------------------------------------------------
// D. Authenticated user can access order history
// ---------------------------------------------------------------------------

test.describe("D. Authenticated user: order history access", () => {
  test("should display order history after successful login", async ({
    page,
  }) => {
    // 1. Set up auth API mock (login + /auth/me endpoints)
    await mockAuthAPI(page, PERSONAS.CUSTOMER);

    // 2. Mock the customer orders endpoint
    await page.route(new RegExp(`${API_RE}/customers/me/orders`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            orders: [createMockOrder()],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        }),
      }),
    );

    // 3. Navigate to login page
    await page.goto("/login");

    // 4. Wait for login form
    const usernameInput = page
      .locator("#username")
      .or(page.locator('input[name="username"]'));
    await expect(usernameInput.first()).toBeVisible({ timeout: 8000 });

    // 5. Fill in CUSTOMER credentials
    await usernameInput.first().fill(PERSONAS.CUSTOMER.username);

    const passwordInput = page
      .locator("#password")
      .or(page.locator('input[name="password"]'))
      .or(page.locator('input[type="password"]'));
    await expect(passwordInput.first()).toBeVisible({ timeout: 5000 });
    await passwordInput.first().fill(PERSONAS.CUSTOMER.password);

    // 6. Submit the login form
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.first().click();

    // 7. Wait for login to redirect away from /login (client-side nav)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    // 8. Wait for the client-side redirect to /orders to settle
    // NOTE: Do NOT use page.goto("/orders") — a full reload resets Pinia
    // user.value to null (it's not persisted), making isAuthenticated=false,
    // so the router guard would redirect straight back to /login.
    await expect(page).toHaveURL(/\/orders/, { timeout: 8000 });

    // 9. Verify order history content is visible:
    //    Either order data (order number) or the authenticated empty-state text
    const orderHistoryContent = page
      .locator("text=/ORD-/")
      .or(page.locator('[data-testid="order-number"]'))
      .or(page.locator('[data-testid="order-list"]'))
      .or(page.locator('[data-testid="order-history"]'))
      .or(page.locator("text=/暫無訂單|No Orders|沒有訂單|尚無訂單/"));

    await expect(orderHistoryContent.first()).toBeVisible({ timeout: 8000 });

    // 10. Must NOT have been redirected back to login
    expect(page.url()).not.toContain("/login");
  });

  test("should show empty state text when authenticated but no orders exist", async ({
    page,
  }) => {
    // Set up auth mock
    await mockAuthAPI(page, PERSONAS.CUSTOMER);

    // Return empty orders list
    await page.route(new RegExp(`${API_RE}/customers/me/orders`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            orders: [],
            total: 0,
            page: 1,
            totalPages: 0,
          },
        }),
      }),
    );

    // Navigate to login and log in
    await page.goto("/login");

    const usernameInput = page
      .locator("#username")
      .or(page.locator('input[name="username"]'));
    await expect(usernameInput.first()).toBeVisible({ timeout: 8000 });
    await usernameInput.first().fill(PERSONAS.CUSTOMER.username);

    const passwordInput = page
      .locator("#password")
      .or(page.locator('input[name="password"]'))
      .or(page.locator('input[type="password"]'));
    await passwordInput.first().fill(PERSONAS.CUSTOMER.password);

    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect away from login (client-side nav — do NOT use page.goto)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/orders/, { timeout: 8000 });

    // Empty state should be visible when there are no orders
    // "orderHistory.noOrders" translates to "暫無訂單" (zh-TW) / "No Orders" (en-US)
    const emptyState = page
      .locator("text=/暫無訂單/")
      .or(page.locator("text=/No Orders/"))
      .or(page.locator("text=/沒有訂單/"))
      .or(page.locator("text=/尚無訂單/"))
      .or(page.locator('[data-testid="empty-orders"]'));

    await expect(emptyState.first()).toBeVisible({ timeout: 8000 });
  });
});
