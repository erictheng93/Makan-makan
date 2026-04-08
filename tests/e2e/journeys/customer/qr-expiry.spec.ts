/**
 * QR Code Error Paths
 *
 * Tests the various failure modes a customer can encounter when a QR code is
 * invalid, expired, or belongs to a different restaurant.
 *
 * QR scanning itself is client-side (parseQRContent); these tests focus on
 * the network-level error paths that occur after navigation.
 */

import { test, expect, devices } from "@playwright/test";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockTableAPI,
  mockOrderAPI,
} from "../../helpers/mock-api";
import { PERSONAS, RESTAURANT, TABLE } from "../../helpers/personas";

test.use({ ...devices["iPhone 12"] });

const API_RE = "/api/v1";

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// ---------------------------------------------------------------------------
// Describe 1: Invalid QR format / table not found
// ---------------------------------------------------------------------------

test.describe("QR scan: invalid format", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockOrderAPI(page);

    // Table QR lookup returns 404
    await page.route(new RegExp(`${API_RE}/tables/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "TABLE_NOT_FOUND",
              message: "桌台不存在",
            },
          },
          404,
        ),
      ),
    );

    // Seats QR lookup also returns 404
    await page.route(new RegExp(`${API_RE}/seats/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "TABLE_NOT_FOUND",
              message: "桌台不存在",
            },
          },
          404,
        ),
      ),
    );

    // Menu for the restaurant also returns 404 (table context invalid)
    await page.route(new RegExp(`${API_RE}/menu/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "TABLE_NOT_FOUND",
                message: "桌台不存在",
              },
            },
            404,
          ),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should show an error indicator when table is not found", async ({
    page,
  }) => {
    // Navigate directly to an unknown table URL
    await page.goto(`/restaurant/${RESTAURANT.id}/table/999`);
    await page.waitForLoadState("networkidle");

    // Accept a broad range of error indicators
    const errorIndicator = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="error"]'))
      .or(page.locator("text=/錯誤|error|失敗|不存在|過期/i"))
      .or(page.locator("text=/TABLE_NOT_FOUND/i"))
      .or(page.locator("text=/桌台不存在/"))
      .or(page.locator('[data-testid="error-page"]'))
      .or(page.locator('[class*="error"]'));

    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Describe 2: Expired table QR (401)
// ---------------------------------------------------------------------------

test.describe("QR scan: expired table QR", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockOrderAPI(page);

    // Table QR lookup returns 401 QR_EXPIRED
    await page.route(new RegExp(`${API_RE}/tables/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "QR_EXPIRED",
              message: "QR Code 已過期，請向服務員索取新的 QR Code",
            },
          },
          401,
        ),
      ),
    );

    await page.route(new RegExp(`${API_RE}/seats/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "QR_EXPIRED",
              message: "QR Code 已過期，請向服務員索取新的 QR Code",
            },
          },
          401,
        ),
      ),
    );

    // Menu lookup also fails in this scenario
    await page.route(new RegExp(`${API_RE}/menu/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(
          json(
            {
              success: false,
              error: { code: "QR_EXPIRED", message: "QR Code 已過期" },
            },
            401,
          ),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should display friendly error message, not a blank page", async ({
    page,
  }) => {
    await page.goto(`/restaurant/${RESTAURANT.id}/table/${TABLE.id}`);
    await page.waitForLoadState("networkidle");

    // Verify a user-readable error is displayed
    const errorMessage = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="error"]'))
      .or(page.locator("text=/已過期|過期|expired/i"))
      .or(page.locator("text=/QR/i"))
      .or(page.locator('[data-testid="error-page"]'))
      .or(page.locator("text=/錯誤|失敗/i"));

    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display retry or home button on expired QR page", async ({
    page,
  }) => {
    await page.goto(`/restaurant/${RESTAURANT.id}/table/${TABLE.id}`);
    await page.waitForLoadState("networkidle");

    // Verify an action button is available
    const actionButton = page
      .locator('button:has-text("重試")')
      .or(page.locator('button:has-text("Retry")'))
      .or(page.locator('button:has-text("首頁")'))
      .or(page.locator('button:has-text("回首頁")'))
      .or(page.locator('a:has-text("首頁")'))
      .or(page.locator('a[href="/"]'))
      .or(page.locator('[data-testid="home-btn"]'))
      .or(page.locator('[data-testid="retry-btn"]'));

    await expect(actionButton.first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Describe 3: Wrong restaurant (403)
// ---------------------------------------------------------------------------

test.describe("QR scan: wrong restaurant", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);
    await mockRestaurantAPI(page);
    await mockOrderAPI(page);

    // Table QR lookup returns 403 WRONG_RESTAURANT
    await page.route(new RegExp(`${API_RE}/tables/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "WRONG_RESTAURANT",
              message: "此 QR Code 不屬於此餐廳",
            },
          },
          403,
        ),
      ),
    );

    await page.route(new RegExp(`${API_RE}/seats/qr/.+`), (route) =>
      route.fulfill(
        json(
          {
            success: false,
            error: {
              code: "WRONG_RESTAURANT",
              message: "此 QR Code 不屬於此餐廳",
            },
          },
          403,
        ),
      ),
    );

    // Menu also fails
    await page.route(new RegExp(`${API_RE}/menu/[^/]+$`), (route) => {
      if (route.request().method() === "GET") {
        route.fulfill(
          json(
            {
              success: false,
              error: {
                code: "WRONG_RESTAURANT",
                message: "此 QR Code 不屬於此餐廳",
              },
            },
            403,
          ),
        );
      } else {
        route.continue();
      }
    });
  });

  test("should display error when QR code belongs to different restaurant", async ({
    page,
  }) => {
    await page.goto(`/restaurant/${RESTAURANT.id}/table/${TABLE.id}`);
    await page.waitForLoadState("networkidle");

    const errorIndicator = page
      .locator('[role="alert"]')
      .or(page.locator('[data-testid="error"]'))
      .or(page.locator("text=/不屬於|wrong|錯誤|失敗|WRONG/i"))
      .or(page.locator("text=/餐廳/"))
      .or(page.locator('[data-testid="error-page"]'))
      .or(page.locator('[class*="error"]'));

    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Describe 4: Error page renders correctly with QR error codes
// ---------------------------------------------------------------------------

test.describe("Error page: renders correctly with QR error codes", () => {
  test("should render error heading on /error?code=QR_EXPIRED", async ({
    page,
  }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);

    await page.goto(
      "/error?code=QR_EXPIRED&message=QR+Code+%E5%B7%B2%E9%81%8E%E6%9C%9F",
    );
    await page.waitForLoadState("networkidle");

    // Verify an error heading or message is displayed
    const errorHeading = page
      .locator("h1, h2, h3")
      .or(page.locator('[data-testid="error-title"]'))
      .or(page.locator('[data-testid="error-heading"]'))
      .or(page.locator("text=/錯誤|Error|過期|QR/i"))
      .or(page.locator('[role="alert"]'));

    await expect(errorHeading.first()).toBeVisible({ timeout: 10000 });
  });

  test("should show home button on /error page", async ({ page }) => {
    await mockAuthAPI(page, PERSONAS.CUSTOMER);

    await page.goto(
      "/error?code=QR_EXPIRED&message=QR+Code+%E5%B7%B2%E9%81%8E%E6%9C%9F",
    );
    await page.waitForLoadState("networkidle");

    const homeButton = page
      .locator('button:has-text("首頁")')
      .or(page.locator('a:has-text("首頁")'))
      .or(page.locator('button:has-text("回首頁")'))
      .or(page.locator('a:has-text("回首頁")'))
      .or(page.locator('a[href="/"]'))
      .or(page.locator('[data-testid="home-btn"]'))
      .or(page.locator('button:has-text("Home")'))
      .or(page.locator('a:has-text("Home")'));

    await expect(homeButton.first()).toBeVisible({ timeout: 10000 });
  });
});
