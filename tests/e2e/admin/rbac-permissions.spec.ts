/**
 * RBAC Permission Boundary E2E Tests
 *
 * Verifies role-based access control:
 * - Owner (role 1) cannot access platform-only routes
 * - Cashier (role 4) can only access POS and order-related routes
 * - Chef (role 2) is restricted to kitchen/dashboard
 * - Service crew (role 3) can access orders and service routes
 * - Admin (role 0) has full access
 */

import { test, expect } from "@playwright/test";
import { PERSONAS } from "../helpers/personas";
import {
  mockAuthAPI,
  mockRestaurantAPI,
  mockMenuAPI,
  mockOrderAPI,
  mockSSE,
  mockAnalyticsAPI,
  mockPOSAPI,
  mockKitchenAPI,
  mockTableAPI,
  mockQueueAPI,
} from "../helpers/mock-api";
import { loginAs, expectNavigatedTo } from "../helpers/assertions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupMocksAndLogin(
  page: import("@playwright/test").Page,
  persona: (typeof PERSONAS)[keyof typeof PERSONAS],
) {
  await mockAuthAPI(page, persona);
  await mockRestaurantAPI(page);
  await mockMenuAPI(page);
  await mockOrderAPI(page);
  await mockSSE(page);
  await mockAnalyticsAPI(page);
  await mockPOSAPI(page);
  await mockKitchenAPI(page);
  await mockTableAPI(page);
  await mockQueueAPI(page);

  // Set auth state in localStorage so the router guard considers user authenticated
  await page.addInitScript((p) => {
    localStorage.setItem("auth_token", p.token);
    localStorage.setItem("auth_refresh_token", p.refreshToken);
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: p.id,
        username: p.username,
        fullName: p.fullName,
        email: p.email,
        role: p.role,
        restaurantId: p.restaurantId,
      }),
    );
  }, persona);
}

// ---------------------------------------------------------------------------
// Owner (role 1) — Cannot access platform management
// ---------------------------------------------------------------------------

test.describe("RBAC: Owner role boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocksAndLogin(page, PERSONAS.OWNER);
  });

  test("Owner can access dashboard home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Should stay on dashboard, not be redirected to /unauthorized
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner can access orders page", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/orders");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner can access menu management", async ({ page }) => {
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/menu");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner can access owner overview", async ({ page }) => {
    await page.goto("/dashboard/owner-overview");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/owner-overview");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner can access analytics", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/analytics");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner can access POS", async ({ page }) => {
    await page.goto("/dashboard/pos/checkout");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/pos");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Owner CANNOT access platform management (Admin only)", async ({
    page,
  }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    // Should redirect to /unauthorized
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Owner CANNOT access account management (Admin only)", async ({
    page,
  }) => {
    await page.goto("/dashboard/account-management");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Cashier (role 4) — Only POS, orders, seating, group orders
// ---------------------------------------------------------------------------

test.describe("RBAC: Cashier role boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocksAndLogin(page, PERSONAS.CASHIER);
  });

  test("Cashier can access dashboard home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Cashier can access POS checkout", async ({ page }) => {
    await page.goto("/dashboard/pos/checkout");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/pos");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Cashier can access orders", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/orders");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Cashier can access group orders", async ({ page }) => {
    await page.goto("/dashboard/group-orders");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/group-orders");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Cashier CANNOT access menu management", async ({ page }) => {
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access analytics", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access employee management", async ({ page }) => {
    await page.goto("/dashboard/employees");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access settings", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access platform management", async ({ page }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access owner overview", async ({ page }) => {
    await page.goto("/dashboard/owner-overview");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Cashier CANNOT access monitoring", async ({ page }) => {
    await page.goto("/dashboard/monitoring");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Chef (role 2) — Dashboard home only (no orders, menu, POS, analytics)
// ---------------------------------------------------------------------------

test.describe("RBAC: Chef role boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocksAndLogin(page, PERSONAS.CHEF);
  });

  test("Chef can access dashboard home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Chef CANNOT access orders", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access menu management", async ({ page }) => {
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access POS", async ({ page }) => {
    await page.goto("/dashboard/pos/checkout");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access analytics", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access employee management", async ({ page }) => {
    await page.goto("/dashboard/employees");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access settings", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Chef CANNOT access platform management", async ({ page }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Service Crew (role 3) — Orders, seating, service, group orders
// ---------------------------------------------------------------------------

test.describe("RBAC: Service Crew role boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocksAndLogin(page, PERSONAS.SERVICE_CREW);
  });

  test("Service crew can access dashboard home", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Service crew can access orders", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/orders");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Service crew can access service delivery", async ({ page }) => {
    await page.goto("/service");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/service");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Service crew CANNOT access menu management", async ({ page }) => {
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Service crew CANNOT access POS", async ({ page }) => {
    await page.goto("/dashboard/pos/checkout");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Service crew CANNOT access analytics", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Service crew CANNOT access settings", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });

  test("Service crew CANNOT access platform management", async ({ page }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Admin (role 0) — Full access to all routes
// ---------------------------------------------------------------------------

test.describe("RBAC: Admin role full access", () => {
  test.beforeEach(async ({ page }) => {
    const adminWithContext = { ...PERSONAS.ADMIN };
    await setupMocksAndLogin(page, adminWithContext);
    // Admin needs restaurant context to access restaurant-scoped routes
    await page.addInitScript(() => {
      sessionStorage.setItem("admin_selected_restaurant_id", "rest-e2e-001");
      sessionStorage.setItem("admin_selected_restaurant_name", "E2E 測試餐廳");
    });
  });

  test("Admin can access platform management", async ({ page }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/platform");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access account management", async ({ page }) => {
    await page.goto("/dashboard/account-management");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/account-management");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access orders", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/orders");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access menu management", async ({ page }) => {
    await page.goto("/dashboard/menu");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/menu");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access analytics", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/analytics");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access POS", async ({ page }) => {
    await page.goto("/dashboard/pos/checkout");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/pos");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access monitoring", async ({ page }) => {
    await page.goto("/dashboard/monitoring");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/monitoring");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access settings", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/settings");
    expect(page.url()).not.toContain("/unauthorized");
  });

  test("Admin can access employee management", async ({ page }) => {
    await page.goto("/dashboard/employees");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard/employees");
    expect(page.url()).not.toContain("/unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — all dashboard routes redirect to login
// ---------------------------------------------------------------------------

test.describe("RBAC: Unauthenticated user", () => {
  test("Dashboard redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/login");
  });

  test("Orders page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/login");
  });

  test("Platform page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/platform");
    await page.waitForLoadState("networkidle");
    await expectNavigatedTo(page, "/login");
  });
});
