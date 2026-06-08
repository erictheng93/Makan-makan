import { expect, test, type Page, type Route } from "@playwright/test";

const API_URL = process.env.SMOKE_API_URL || "http://localhost:8787";
const ADMIN_URL = process.env.SMOKE_ADMIN_URL || "http://localhost:3001";
const AUTH_USERNAME = process.env.SMOKE_AUTH_USERNAME?.trim();
const AUTH_PASSWORD = process.env.SMOKE_AUTH_PASSWORD?.trim();
const OWNER_ROLE = 1;

interface LoginBody {
  success: boolean;
  data?: {
    token?: string;
    refreshToken?: string;
    user?: {
      id: number;
      username: string;
      role: number;
      restaurantId?: string | null;
      fullName?: string;
      email?: string;
    };
  };
}

interface OwnerSession {
  token: string;
  refreshToken: string | undefined;
  user: NonNullable<LoginBody["data"]>["user"];
}

const restaurantId = "smoke-restaurant-1";
const nowIso = "2026-06-08T08:00:00.000Z";

async function loginOwnerSession(): Promise<OwnerSession> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: AUTH_USERNAME,
      password: AUTH_PASSWORD,
    }),
  });

  expect(response.ok, `owner login status ${response.status}`).toBe(true);
  const body = (await response.json()) as LoginBody;
  expect(body.success, "login should succeed").toBe(true);
  expect(body.data?.user?.role, "user role should be owner").toBe(OWNER_ROLE);

  return {
    token: body.data!.token!,
    refreshToken: body.data?.refreshToken,
    user: {
      ...body.data!.user!,
      restaurantId: body.data!.user!.restaurantId ?? restaurantId,
    },
  };
}

async function setOwnerSession(page: Page, session: OwnerSession) {
  await page.addInitScript((payload) => {
    localStorage.setItem("auth_token", payload.token);
    if (payload.refreshToken) {
      localStorage.setItem("auth_refresh_token", payload.refreshToken);
    }
    localStorage.setItem("auth_user", JSON.stringify(payload.user));
    localStorage.setItem("makanmakan_locale", "en-US");
    localStorage.setItem("locale", "en-US");
    sessionStorage.clear();
    sessionStorage.setItem(
      "admin_selected_restaurant_id",
      payload.user.restaurantId ?? "",
    );
    sessionStorage.setItem("admin_selected_restaurant_name", "Smoke Bistro");
  }, session);
}

function envelope(data: unknown) {
  return { success: true, data };
}

function response(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill(response(data, status));
}

function pathFor(route: Route) {
  return new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
}

function installBackofficeMocks(page: Page) {
  const stats = {
    users: 0,
    tables: 0,
    groupOrders: 0,
    serviceBookings: 0,
    feedback: 0,
    monitoring: 0,
    settings: 0,
  };

  page.route("**/api/v1/**", async (route) => {
    const path = pathFor(route);
    const method = route.request().method();

    if (
      path === "/auth/me" ||
      path === "/me/modules" ||
      path.startsWith("/realtime/")
    ) {
      await route.continue();
      return;
    }

    if (method === "GET" && path === "/users") {
      stats.users += 1;
      await fulfill(
        route,
        envelope([
          {
            id: 41,
            username: "owner-smoke",
            fullName: "Owner Smoke",
            email: "owner-smoke@example.test",
            role: 1,
            isActive: true,
            createdAt: nowIso,
          },
          {
            id: 42,
            username: "chef-smoke",
            fullName: "Chef Smoke",
            email: "chef-smoke@example.test",
            role: 2,
            isActive: true,
            createdAt: nowIso,
          },
        ]),
      );
      return;
    }

    if (method === "GET" && path.includes("/scheduling/clocked-in")) {
      await fulfill(route, envelope([]));
      return;
    }

    if (method === "GET" && /^\/leaves\/[^/]+\/requests$/.test(path)) {
      await fulfill(route, envelope([]));
      return;
    }

    if (method === "GET" && path === "/tables") {
      stats.tables += 1;
      await fulfill(
        route,
        envelope([
          {
            id: 11,
            tableNumber: "A1",
            capacity: 4,
            status: "available",
            location: "Window",
            qrCode: "table-a1-smoke",
            isActive: true,
          },
          {
            id: 12,
            tableNumber: "B2",
            capacity: 2,
            status: "occupied",
            location: "Patio",
            qrCode: "table-b2-smoke",
            currentOrderId: 9001,
            isActive: true,
          },
        ]),
      );
      return;
    }

    if (method === "GET" && /^\/reservations\/stats\/[^/]+$/.test(path)) {
      await fulfill(
        route,
        envelope({
          totalReservations: 3,
          confirmedCount: 2,
          completedCount: 1,
          noShowRate: 0,
        }),
      );
      return;
    }

    if (method === "GET" && path === "/reservations") {
      await fulfill(route, envelope([]));
      return;
    }

    if (
      method === "GET" &&
      /^\/waiting-list\/queue-status\/[^/]+$/.test(path)
    ) {
      await fulfill(
        route,
        envelope({
          totalWaiting: 1,
          averageWaitMinutes: 12,
          availableTables: 2,
        }),
      );
      return;
    }

    if (method === "GET" && /^\/waiting-list\/stats\/[^/]+$/.test(path)) {
      await fulfill(route, envelope({ totalServedToday: 5 }));
      return;
    }

    if (method === "GET" && path === "/orders/group") {
      stats.groupOrders += 1;
      await fulfill(
        route,
        envelope([
          {
            id: "group-1",
            shareCode: "SMOKE42",
            masterOrderId: null,
            tableNumber: "A1",
            status: "active",
            hostName: "Group Host",
            memberCount: 3,
            totalAmount: 1280,
            subtotal: 1200,
            serviceCharge: 80,
            taxAmount: 0,
            itemCount: 4,
            members: [
              {
                id: "member-1",
                groupOrderId: "group-1",
                name: "Alice",
                itemCount: 2,
                totalAmount: 640,
                paymentStatus: "unpaid",
                joinedAt: nowIso,
              },
            ],
            createdAt: nowIso,
            completedAt: null,
            expiresAt: "2026-06-08T09:00:00.000Z",
          },
        ]),
      );
      return;
    }

    if (method === "GET" && path === "/service-bookings") {
      stats.serviceBookings += 1;
      await fulfill(
        route,
        envelope({
          bookings: [
            {
              id: "booking-1",
              restaurantId,
              serviceItemId: 7,
              serviceNameSnapshot: "Private Tasting",
              customerName: "Booking Smoke",
              customerPhone: "0912345678",
              customerEmail: "booking@example.test",
              bookingDate: "2026-06-08",
              bookingTime: "18:30",
              partySize: 4,
              status: "confirmed",
              confirmationCode: "BKSMOKE",
              paymentRequirement: "deposit",
              depositRequiredCents: 50000,
              balanceDueCents: 150000,
              amountDueCents: 200000,
              amountPaidCents: 50000,
              paymentStatus: "deposit_paid",
              paymentMethod: "cash",
              reminderOptIn: 1,
              calendarUid: "booking-1@example.test",
              specialRequests: "Window seat",
            },
          ],
        }),
      );
      return;
    }

    if (method === "GET" && path === "/feedback") {
      stats.feedback += 1;
      await fulfill(route, {
        feedback: [
          {
            id: 71,
            restaurantId,
            userId: 41,
            category: "feature",
            priority: "medium",
            status: "open",
            relatedModule: "orders",
            subject: "Smoke feedback subject",
            description: "Smoke feedback description",
            attachmentUrls: [],
            createdAt: nowIso,
            updatedAt: nowIso,
            resolvedAt: null,
            resolvedBy: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      return;
    }

    if (method === "GET" && path === "/feedback/stats") {
      await fulfill(
        route,
        envelope({
          total: 1,
          byStatus: { open: 1 },
          byCategory: { feature: 1 },
          byPriority: { medium: 1 },
          avgResolutionTimeMs: null,
        }),
      );
      return;
    }

    if (method === "GET" && path.startsWith("/monitoring/")) {
      stats.monitoring += 1;
      if (path === "/monitoring/overview") {
        await fulfill(
          route,
          envelope({
            status: "healthy",
            uptime: 3600000,
            keyMetrics: {
              requestsPerMinute: 24,
              averageResponseTime: 82,
              cacheHitRate: 88,
              activeErrors: 0,
            },
            components: [
              {
                name: "api",
                status: "healthy",
                latency: 82,
                issues: 0,
                issueDetails: [],
                lastCheck: Date.now(),
              },
            ],
            topErrors: [],
            recentAlerts: [],
            componentHealth: [
              { name: "API", status: "healthy", responseTime: 82 },
            ],
          }),
        );
        return;
      }

      if (path === "/monitoring/metrics") {
        await fulfill(
          route,
          envelope({
            apiMetrics: {
              totalRequests: 200,
              averageResponseTime: 82,
              p95ResponseTime: 140,
              errorRate: 0.01,
            },
            databaseMetrics: {
              totalQueries: 50,
              averageQueryTime: 12,
              slowQueries: 0,
            },
            cacheMetrics: {
              hitRate: 0.88,
              totalHits: 88,
              totalMisses: 12,
              keyCount: 20,
            },
            errorMetrics: {
              totalErrors: 1,
              criticalErrors: 0,
              errorsByType: {},
            },
          }),
        );
        return;
      }

      if (path === "/monitoring/alerts/rules") {
        await fulfill(
          route,
          envelope({
            rules: [
              {
                id: "rule-1",
                name: "Smoke latency rule",
                type: "performance",
                config: { severity: "warning" },
                isActive: true,
                threshold: 1000,
                condition: "greater_than",
                triggerCount: 0,
                lastTriggered: null,
                createdAt: Date.now(),
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
        );
        return;
      }

      if (path === "/monitoring/reports/performance") {
        await fulfill(
          route,
          envelope({
            period: { days: 7 },
            apiPerformance: {
              totalRequests: 200,
              averageResponseTime: 82,
              p95ResponseTime: 140,
              errorRate: 0.01,
            },
            databasePerformance: {
              totalQueries: 50,
              averageQueryTime: 12,
              slowQueries: 0,
            },
            cachePerformance: {
              hitRate: 0.88,
              totalHits: 88,
              totalMisses: 12,
              keyCount: 20,
              expiringKeys: 2,
            },
            trends: [],
            recommendations: ["Smoke recommendation"],
          }),
        );
        return;
      }
    }

    if (method === "GET" && /^\/restaurants\/[^/]+$/.test(path)) {
      stats.settings += 1;
      await fulfill(
        route,
        envelope({
          name: "Smoke Bistro",
          phone: "02-1234-5678",
          address: "1 Smoke Road",
          city: "Taipei",
          district: "Da'an",
          supportsTakeaway: true,
          settings: {
            currency: "TWD",
            enableDineIn: true,
            enableTakeaway: true,
            enableDelivery: false,
            deliveryFee: 0,
            estimatedPrepTimeMin: 10,
            estimatedPrepTimeMax: 20,
          },
        }),
      );
      return;
    }

    if (method === "GET" && /^\/restaurants\/[^/]+\/qr\/shop$/.test(path)) {
      await fulfill(
        route,
        envelope({
          enabled: true,
          qrCode: "SHOP-SMOKE",
          qrCodeImageUrl: "",
          version: 1,
          settings: {},
        }),
      );
      return;
    }

    if (
      method === "GET" &&
      /^\/restaurants\/[^/]+\/contact-profile$/.test(path)
    ) {
      await fulfill(
        route,
        envelope({
          messagingChannels: { line: "@smoke" },
          faqs: [
            {
              id: 1,
              question: "Smoke FAQ",
              answer: "Smoke answer",
              keywords: ["smoke"],
              displayOrder: 1,
              isActive: true,
            },
          ],
        }),
      );
      return;
    }

    if (method === "GET" && path === "/markets") {
      await fulfill(
        route,
        envelope({ markets: [], total: 0, page: 1, limit: 100 }),
      );
      return;
    }

    if (method === "GET" && /^\/restaurants\/[^/]+\/markets$/.test(path)) {
      await fulfill(route, envelope({ memberships: [] }));
      return;
    }

    if (
      method === "GET" &&
      /^\/restaurants\/[^/]+\/market-join-requests$/.test(path)
    ) {
      await fulfill(route, envelope({ requests: [] }));
      return;
    }

    if (
      method === "GET" &&
      /^\/restaurants\/[^/]+\/service-items$/.test(path)
    ) {
      await fulfill(route, envelope([]));
      return;
    }

    if (method === "GET" && path === "/service-bookings/slots") {
      await fulfill(route, envelope({ slots: [] }));
      return;
    }

    await fulfill(route, envelope({}));
  });

  return stats;
}

async function openBackofficePage(
  page: Page,
  session: OwnerSession,
  path: string,
) {
  await setOwnerSession(page, session);
  await page.goto(`${ADMIN_URL}${path}`, { waitUntil: "networkidle" });
}

test.describe("Smoke: owner backoffice management pages (owner role)", () => {
  test.beforeEach(async () => {
    test.skip(
      !AUTH_USERNAME || !AUTH_PASSWORD,
      "Owner credentials are not configured",
    );
  });

  test("1) Seating management renders table setup with mocked table data", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/seating/table-setup");

    await expect(page).toHaveURL(/\/dashboard\/seating\/table-setup/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /Seating/i }),
    ).toBeVisible();
    await expect(page.getByText(/A1/).first()).toBeVisible();
    await expect(page.getByText(/B2/).first()).toBeVisible();
    expect(stats.tables).toBeGreaterThan(0);
  });

  test("2) Employee management renders staff list and status filters", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/employees");

    await expect(page).toHaveURL(/\/dashboard\/employees/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /Employee/i }),
    ).toBeVisible();
    await expect(page.getByText("Owner Smoke")).toBeVisible();
    await expect(page.getByText("Chef Smoke")).toBeVisible();
    expect(stats.users).toBeGreaterThan(0);
  });

  test("3) Group orders renders active group order and quick actions", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/group-orders");

    await expect(page).toHaveURL(/\/dashboard\/group-orders/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /Group Orders/i }),
    ).toBeVisible();
    await expect(page.getByText("SMOKE42").first()).toBeVisible();
    await expect(page.getByText("Group Host").first()).toBeVisible();
    expect(stats.groupOrders).toBeGreaterThan(0);
  });

  test("4) Service bookings renders booking table and refresh control", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/service-bookings");

    await expect(page).toHaveURL(/\/dashboard\/service-bookings/);
    await expect(page.getByTestId("service-bookings-view")).toBeVisible();
    const bookingRow = page
      .getByTestId("service-booking-row")
      .filter({ hasText: "Booking Smoke" });
    await expect(bookingRow).toBeVisible();
    await expect(bookingRow).toContainText("BKSMOKE");
    await expect(bookingRow).toContainText("2026-06-08");

    const refreshButton = page.getByTestId("service-bookings-refresh");
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();
    await expect(bookingRow).toBeVisible();
    expect(stats.serviceBookings).toBeGreaterThan(1);
  });

  test("5) Feedback renders owner feedback list and submit entry point", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/feedback");

    await expect(page).toHaveURL(/\/dashboard\/feedback/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /^Feedback$/i }),
    ).toBeVisible();
    await expect(page.getByText("Smoke feedback subject")).toBeVisible();
    await expect(page.getByText("Smoke feedback description")).toBeVisible();
    expect(stats.feedback).toBeGreaterThan(0);
  });

  test("6) Monitoring renders health, metrics, and alert rule surfaces", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/monitoring");

    await expect(page).toHaveURL(/\/dashboard\/monitoring/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /Monitoring/i }),
    ).toBeVisible();
    await expect(page.getByText(/Overall/i).first()).toBeVisible();
    await expect(page.getByText(/Smoke latency rule/)).toBeVisible();
    expect(stats.monitoring).toBeGreaterThanOrEqual(3);
  });

  test("7) System settings renders persisted restaurant and contact settings", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const stats = installBackofficeMocks(page);
    await openBackofficePage(page, session, "/dashboard/settings");

    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /^Settings$/i }),
    ).toBeVisible();
    await expect(page.locator("input").nth(0)).toHaveValue("Smoke Bistro");
    await expect(page.locator("input").nth(1)).toHaveValue("02-1234-5678");
    expect(stats.settings).toBeGreaterThan(0);
  });
});
