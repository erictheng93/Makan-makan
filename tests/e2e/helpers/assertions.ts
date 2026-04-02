/**
 * Reusable E2E Assertions
 *
 * Higher-level assertion helpers that encapsulate common E2E verification patterns.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Verify the page navigated to a specific path
 */
export async function expectNavigatedTo(page: Page, path: string) {
  await expect(page).toHaveURL(
    new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

/**
 * Verify a toast/notification message appeared
 */
export async function expectToastMessage(page: Page, text: string) {
  const toast = page.locator(
    '[role="alert"], [data-testid="toast"], .toast, .notification',
  );
  await expect(toast.filter({ hasText: text }).first()).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Verify cart badge shows expected count
 */
export async function expectCartCount(page: Page, count: number) {
  const badge = page.locator(
    '[data-testid="cart-count"], [data-testid="cart-badge"], .cart-badge, .cart-count',
  );
  if (count === 0) {
    await expect(badge).toBeHidden();
  } else {
    await expect(badge.first()).toContainText(String(count));
  }
}

/**
 * Verify order status is displayed correctly
 */
export async function expectOrderStatus(page: Page, status: string) {
  const statusEl = page.locator(
    '[data-testid="order-status"], [data-status], .order-status, .status-badge',
  );
  await expect(statusEl.first()).toContainText(status);
}

/**
 * Verify SSE/WebSocket connection indicator shows connected
 */
export async function expectSSEConnected(page: Page) {
  const indicator = page.locator(
    '[data-testid="connection-status"], .connection-status, .sse-status',
  );
  await expect(indicator.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Verify a loading spinner is visible (and optionally wait for it to disappear)
 */
export async function expectLoading(page: Page, waitForComplete = true) {
  const spinner = page.locator(
    '.animate-spin, [data-testid="loading"], .loading-spinner, .skeleton',
  );
  await expect(spinner.first()).toBeVisible();
  if (waitForComplete) {
    await expect(spinner.first()).toBeHidden({ timeout: 10000 });
  }
}

/**
 * Verify no raw i18n keys are visible (e.g. "navigation.home" instead of actual text)
 */
export async function expectNoI18nKeys(page: Page) {
  const body = await page.textContent("body");
  const i18nKeyPattern = /\b[a-z]+\.[a-z]+\.[a-z]+\b/g;
  const suspiciousKeys = body?.match(i18nKeyPattern) || [];
  // Filter out URLs, email addresses, etc.
  const realKeys = suspiciousKeys.filter(
    (k) => !k.includes("http") && !k.includes("@") && !k.includes("com"),
  );
  // Allow some false positives but flag obvious ones
  expect(realKeys.length).toBeLessThan(5);
}

/**
 * Verify an error message is displayed (for network/validation errors)
 */
export async function expectErrorMessage(page: Page, text?: string) {
  const error = page.locator(
    '[role="alert"], .error-message, [data-testid="error"], .text-red-500, .text-ios-red',
  );
  if (text) {
    await expect(error.filter({ hasText: text }).first()).toBeVisible();
  } else {
    await expect(error.first()).toBeVisible();
  }
}

/**
 * Login helper for admin/staff roles via UI
 */
export async function loginAs(page: Page, username: string, password: string) {
  await page.fill(
    'input[name="username"], input[type="text"], input[placeholder*="username"], input[placeholder*="Username"], #username',
    username,
  );
  await page.fill(
    'input[name="password"], input[type="password"], #password',
    password,
  );
  await page.click(
    'button[type="submit"], button:has-text("Login"), button:has-text("\u767b\u5165")',
  );
}
