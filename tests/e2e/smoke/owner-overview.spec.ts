import { expect, test, type Page } from "@playwright/test";
import {
  getSmokeOwnerSession,
  hasSmokeOwnerCredentials,
  setSmokeOwnerSession,
  type SmokeOwnerSession,
} from "./owner-auth";

const ADMIN_URL = process.env.SMOKE_ADMIN_URL || "http://localhost:3001";

const LABELS = {
  quickActions: /Quick Actions/i,
  addStaff: /Add Staff/i,
  updateMenu: /Update Menu/i,
  viewReports: /View Reports/i,
  systemSettings: /System Settings/i,
  realtimeOrders: /Real-time Orders/i,
  staffActivity: /Staff Activity/i,
  todayFinance: /Today's Finance/i,
  revenueTrend: /Revenue Trend/i,
  popularItems: /Popular Items/i,
  systemHealth: /System Health/i,
  noData: /No data available/i,
  retry: /Retry/i,
};

type OwnerContext = SmokeOwnerSession;

interface MockRouteResult {
  status: number;
  body: unknown;
}

const defaultDashboard = {
  summary: {
    todayRevenue: 1250,
    todayOrders: 25,
    monthRevenue: 37250,
    monthOrders: 420,
    growthRates: {
      revenueGrowth: 12.5,
      orderGrowth: -3.8,
    },
  },
  topSellingItems: [
    { itemId: 101, itemName: "Signature Soup", quantity: 18, revenue: 540 },
    { itemId: 102, itemName: "Braised Noodles", quantity: 12, revenue: 360 },
    { itemId: 103, itemName: "Herbal Chicken", quantity: 9, revenue: 198 },
  ],
  tableStatus: {
    occupied: 3,
    available: 7,
    total: 10,
  },
};

const defaultActiveOrders = [
  {
    id: 301,
    orderNumber: "A-301",
    status: "preparing",
    totalAmount: 180,
    tableId: 8,
    createdAt: new Date().toISOString(),
    items: [{ id: 1 }, { id: 2 }, { id: 3 }],
  },
  {
    id: 302,
    orderNumber: "A-302",
    status: "ready",
    totalAmount: 220,
    tableId: 2,
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    items: [{ id: 1 }, { id: 2 }],
  },
];

const defaultUserStats = {
  summary: {
    total_users: 14,
    active_users: 9,
    inactive_users: 5,
  },
};

const defaultUsers = [
  {
    id: 1,
    username: "owner-main",
    fullName: "Owner Main",
    role: 1,
    status: "active",
  },
  {
    id: 2,
    username: "chef-a",
    fullName: "Chef A",
    role: 2,
    status: "active",
  },
  {
    id: 3,
    username: "service-a",
    fullName: "Service A",
    role: 3,
    status: "inactive",
  },
];

const defaultHealth = {
  overall: "healthy",
  components: {
    api: {
      status: "healthy",
      latency: 24,
      errorRate: 0,
      lastCheck: Date.now(),
      issues: [],
    },
    database: {
      status: "healthy",
      latency: 4,
      errorRate: 0,
      lastCheck: Date.now(),
      issues: [],
    },
    cache: {
      status: "healthy",
      lastCheck: Date.now(),
      issues: [],
    },
    external: {
      status: "healthy",
      lastCheck: Date.now(),
      issues: [],
    },
  },
  uptime: 1000,
  version: "2.0.0",
  timestamp: Date.now(),
};

function successResponse(body: unknown): MockRouteResult {
  return {
    status: 200,
    body: { success: true, data: body },
  };
}

function failureResponse(message = "mocked API failure"): MockRouteResult {
  return {
    status: 500,
    body: { success: false, error: { message } },
  };
}

function mockBuild({ status, body }: MockRouteResult) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

type HandlerConfig = {
  dashboard?: () => MockRouteResult;
  activeOrders?: () => MockRouteResult;
  userStats?: () => MockRouteResult;
  users?: () => MockRouteResult;
  health?: () => MockRouteResult;
};

function installOwnerOverviewMocks(page: Page, handlers: HandlerConfig = {}) {
  const dashboard =
    handlers.dashboard ?? (() => successResponse(defaultDashboard));
  const activeOrders =
    handlers.activeOrders ?? (() => successResponse(defaultActiveOrders));
  const userStats =
    handlers.userStats ?? (() => successResponse(defaultUserStats));
  const users = handlers.users ?? (() => successResponse(defaultUsers));
  const health = handlers.health ?? (() => successResponse(defaultHealth));

  const stats = {
    dashboard: 0,
    activeOrders: 0,
    userStats: 0,
    users: 0,
    health: 0,
  };

  page.route("**/api/v1/analytics/dashboard*", async (route) => {
    stats.dashboard += 1;
    await route.fulfill(mockBuild(dashboard()));
  });

  page.route("**/api/v1/orders/active*", async (route) => {
    stats.activeOrders += 1;
    await route.fulfill(mockBuild(activeOrders()));
  });

  page.route("**/api/v1/users*", async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.includes("/users/stats")) {
      stats.userStats += 1;
      await route.fulfill(mockBuild(userStats()));
      return;
    }

    stats.users += 1;
    await route.fulfill(mockBuild(users()));
  });

  page.route("**/api/v1/monitoring/health*", async (route) => {
    stats.health += 1;
    await route.fulfill(mockBuild(health()));
  });

  return {
    stats,
    restore: () => {
      page.unroute("**/api/v1/analytics/dashboard*");
      page.unroute("**/api/v1/orders/active*");
      page.unroute("**/api/v1/users*");
      page.unroute("**/api/v1/monitoring/health*");
    },
  };
}

async function openOwnerOverview(page: Page, ctx: OwnerContext) {
  await setSmokeOwnerSession(page, ctx);
  await page.goto(`${ADMIN_URL}/dashboard/owner-overview`, {
    waitUntil: "networkidle",
  });
}

async function openOwnerOverviewWithFastPoll(
  page: Page,
  ctx: OwnerContext,
  intervalMs: number,
) {
  await page.addInitScript((ms) => {
    const originalSetInterval = window.setInterval;
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const safeTimeout = timeout ?? 0;
      if (safeTimeout === 30000) {
        return originalSetInterval(handler, ms, ...args);
      }
      return originalSetInterval(handler, safeTimeout, ...args);
    }) as typeof window.setInterval;
  }, intervalMs);

  await openOwnerOverview(page, ctx);
}

async function waitForOverviewReady(page: Page) {
  await expect(
    page.getByRole("heading", { name: LABELS.quickActions }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: LABELS.addStaff }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: LABELS.updateMenu }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: LABELS.viewReports }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: LABELS.systemSettings }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.realtimeOrders }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.staffActivity }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.todayFinance }),
  ).toBeVisible();
}

function sectionByHeading(page: Page, heading: RegExp) {
  return page
    .getByRole("heading", { name: heading })
    .locator("xpath=ancestor::*[contains(@class, 'bg-white')][1]");
}

function firstText(page: Page, text: string | RegExp) {
  return page.getByText(text).first();
}

test.describe("Smoke: owner overview workflows (owner role)", () => {
  test.beforeEach(async () => {
    test.skip(
      !hasSmokeOwnerCredentials || !ADMIN_URL,
      "Owner credentials or admin URL is not configured",
    );
  });

  test("1) Owner can enter overview and see the baseline structure", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(
      page.getByRole("heading", { name: LABELS.revenueTrend }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: LABELS.popularItems }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: LABELS.systemHealth }),
    ).toBeVisible();
  });

  test("2) KPI cards show expected dashboard metrics", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(firstText(page, /NT\$1,250/)).toBeVisible();
    await expect(page.getByText("25", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("3/10", { exact: true })).toBeVisible();
  });

  test("3) Trend direction is rendered from dashboard growth rates", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(page.getByText(/\+12\.5%/)).toBeVisible();
    await expect(page.getByText(/-3\.8%/)).toBeVisible();
  });

  test("4) Quick action Add Staff navigates to staff management", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.addStaff }).click();
    await expect(page).toHaveURL(/\/dashboard\/employees/);
  });

  test("5) Quick action Update Menu navigates to menu", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.updateMenu }).click();
    await expect(page).toHaveURL(/\/dashboard\/menu/);
  });

  test("6) Quick action View Reports navigates to analytics", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.viewReports }).click();
    await expect(page).toHaveURL(/\/dashboard\/analytics/);
  });

  test("7) Quick action System Settings navigates to settings", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.systemSettings }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test("8) Realtime orders section shows active orders and mapped status chips", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const realtimeSection = sectionByHeading(page, LABELS.realtimeOrders);
    await expect(realtimeSection.getByText(/Table #8/)).toBeVisible();
    await expect(realtimeSection.getByText(/Table #2/)).toBeVisible();
    await expect(realtimeSection.getByText(/Preparing/)).toBeVisible();
    await expect(realtimeSection.getByText(/Ready/)).toBeVisible();
  });

  test("9) Realtime section shows no-data state when active orders are empty", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page, {
      activeOrders: () => successResponse([]),
    });
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const realtimeSection = sectionByHeading(page, LABELS.realtimeOrders);
    await expect(realtimeSection.getByText(LABELS.noData)).toBeVisible();
    await expect(realtimeSection.getByText(/Preparing/)).toHaveCount(0);
  });

  test("10) Staff activity shows staff names, role labels and online status", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const staffSection = sectionByHeading(page, LABELS.staffActivity);
    await expect(staffSection.getByText("Owner Main")).toBeVisible();
    await expect(staffSection.getByText("Chef A")).toBeVisible();
    await expect(staffSection.getByText("Service A")).toBeVisible();
    await expect(staffSection.getByText("Online")).toHaveCount(2);
    await expect(staffSection.getByText("Offline")).toHaveCount(1);
  });

  test("11) Today's finance block computes avg order value and est. monthly revenue", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const financeSection = sectionByHeading(page, LABELS.todayFinance);
    await expect(
      financeSection.getByText("NT$1,250", { exact: true }),
    ).toBeVisible();
    await expect(financeSection.getByText("25", { exact: true })).toBeVisible();
    await expect(
      financeSection.getByText("NT$50", { exact: true }),
    ).toBeVisible();
    await expect(
      financeSection.getByText("NT$37,500", { exact: true }),
    ).toBeVisible();
  });

  test("12) Revenue trend selector can switch across ranges", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const rangeSelect = page.locator("select");
    await rangeSelect.selectOption("30d");
    expect(await rangeSelect.inputValue()).toBe("30d");
    await rangeSelect.selectOption("3m");
    expect(await rangeSelect.inputValue()).toBe("3m");
    await rangeSelect.selectOption("7d");
    expect(await rangeSelect.inputValue()).toBe("7d");
  });

  test("13) Popular items list renders ranking and metrics", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(
      page.getByRole("heading", { name: LABELS.popularItems }),
    ).toBeVisible();
    await expect(page.getByText("Signature Soup")).toBeVisible();
    await expect(page.getByText("Braised Noodles")).toBeVisible();
    await expect(page.getByText("NT$540")).toBeVisible();
    await expect(page.getByText("NT$360")).toBeVisible();
    await expect(page.getByText("18 sold")).toBeVisible();
    await expect(page.getByText("12 sold")).toBeVisible();
  });

  test("14) System health cards show healthy status for healthy APIs", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    const healthSection = sectionByHeading(page, LABELS.systemHealth);
    await expect(healthSection.getByText(/API Service/)).toBeVisible();
    await expect(healthSection.getByText(/Database/)).toBeVisible();
    await expect(healthSection.getByText(/Realtime System/)).toBeVisible();
    await expect(healthSection.getByText(/Healthy/)).toHaveCount(3);
  });

  test("15) No emergency alerts are rendered when payload is empty", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(page.getByText(/Emergency Alerts/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Resolve/i })).toHaveCount(0);
  });

  test("16) Single API failure degrades gracefully (realtime orders unavailable)", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page, {
      activeOrders: () => failureResponse("orders temporarily unavailable"),
    });
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(page.getByRole("button", { name: LABELS.retry })).toHaveCount(
      0,
    );
    await expect(firstText(page, /NT\$1,250/)).toBeVisible();
    await expect(page.getByText(/Owner Main/)).toBeVisible();
    await expect(page.getByText(LABELS.noData).first()).toBeVisible();
  });

  test("17) Single API failure degrades to warning health while keeping ownership surface", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page, {
      health: () => failureResponse("health unavailable"),
    });
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(page.getByRole("button", { name: LABELS.retry })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: LABELS.quickActions }),
    ).toBeVisible();
    const healthSection = sectionByHeading(page, LABELS.systemHealth);
    await expect(healthSection.getByText(/Warning/)).toHaveCount(2);
    await expect(healthSection.getByText(/Error/)).toHaveCount(0);
  });

  test("18) All APIs fail: owner overview degrades without blocking navigation", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page, {
      dashboard: () => failureResponse("offline"),
      activeOrders: () => failureResponse("offline"),
      userStats: () => failureResponse("offline"),
      users: () => failureResponse("offline"),
      health: () => failureResponse("offline"),
    });

    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await expect(page.getByRole("button", { name: LABELS.retry })).toHaveCount(
      0,
    );
    await expect(page.getByText("NT$0", { exact: true }).first()).toBeVisible();
    expect(await page.getByText(LABELS.noData).count()).toBeGreaterThanOrEqual(
      2,
    );
    const healthSection = sectionByHeading(page, LABELS.systemHealth);
    await expect(healthSection.getByText(/Warning/)).toHaveCount(3);
  });

  test("19) Polling refresh is attached to a 30-second interval", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    let round = 0;
    const mocked = installOwnerOverviewMocks(page, {
      dashboard: () => {
        round += 1;
        return successResponse({
          ...defaultDashboard,
          summary: {
            ...defaultDashboard.summary,
            todayRevenue: round % 2 === 1 ? 1250 : 1650,
          },
        });
      },
    });

    await openOwnerOverviewWithFastPoll(page, session, 1500);
    await waitForOverviewReady(page);
    await expect(firstText(page, /NT\$1,250/)).toBeVisible();
    await expect
      .poll(async () => mocked.stats.dashboard >= 2, { timeout: 10_000 })
      .toBeTruthy();
    await expect(firstText(page, /NT\$1,650/)).toBeVisible({
      timeout: 10_000,
    });
    mocked.restore();
  });

  test("20) Navigate away via quick action and return by browser back keeps context", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.systemSettings }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await page.goBack();
    await waitForOverviewReady(page);
    await expect(page).toHaveURL(/\/dashboard\/owner-overview/);
    await expect(firstText(page, /NT\$1,250/)).toBeVisible();
  });

  test("21) Navigate to another route and return through sidebar to owner overview", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.getByRole("button", { name: LABELS.updateMenu }).click();
    await expect(page).toHaveURL(/\/dashboard\/menu/);
    const sidebarOwnerOverview = page
      .getByRole("link")
      .filter({ hasText: /Owner Overview/i })
      .first();
    if ((await sidebarOwnerOverview.count()) > 0) {
      await sidebarOwnerOverview.click();
    } else {
      await page.goto(`${ADMIN_URL}/dashboard/owner-overview`);
    }
    await waitForOverviewReady(page);
    await expect(page).toHaveURL(/\/dashboard\/owner-overview/);
    await expect(
      page.getByRole("heading", { name: LABELS.quickActions }),
    ).toBeVisible();
  });

  test("22) Returning to owner overview after direct deep-link keeps owner permissions", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOverviewMocks(page);
    await openOwnerOverview(page, session);
    await waitForOverviewReady(page);
    await page.goto(`${ADMIN_URL}/dashboard/settings`);
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await page.goto(`${ADMIN_URL}/dashboard/owner-overview`);
    await waitForOverviewReady(page);
    await expect(firstText(page, /NT\$1,250/)).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
