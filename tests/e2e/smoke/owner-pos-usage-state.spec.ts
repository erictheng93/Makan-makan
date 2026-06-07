import { expect, test, type Page } from "@playwright/test";

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
    };
  };
}

interface OwnerSession {
  token: string;
  refreshToken: string | undefined;
  user: NonNullable<LoginBody["data"]>["user"];
}

interface MockRouteResult {
  status: number;
  body: unknown;
}

interface POSMockHandlers {
  orders: () => MockRouteResult;
  orderStatus: () => MockRouteResult;
  registers: () => MockRouteResult;
  currentShift: () => MockRouteResult;
  dailyRevenue: () => MockRouteResult;
  dailyStats: () => MockRouteResult;
  transactions: () => MockRouteResult;
  promotions: () => MockRouteResult;
  quickPayment: () => MockRouteResult;
  marketCheckoutPay: () => MockRouteResult;
  shiftStart: () => MockRouteResult;
  shiftEnd: () => MockRouteResult;
  createRegister: () => MockRouteResult;
  activateRegister: () => MockRouteResult;
  deactivateRegister: () => MockRouteResult;
  updatePromotion: () => MockRouteResult;
  createPromotion: () => MockRouteResult;
  exportTransactions: () => MockRouteResult;
  cashMovement: () => MockRouteResult;
  shiftReport: () => MockRouteResult;
  printReceipt: () => MockRouteResult;
  refund: () => MockRouteResult;
}

interface POSMockStats {
  orders: number;
  orderStatus: number;
  registers: number;
  currentShift: number;
  dailyRevenue: number;
  dailyStats: number;
  transactions: number;
  promotions: number;
  quickPayment: number;
  marketCheckoutPay: number;
  shiftStart: number;
  shiftEnd: number;
  createRegister: number;
  activateRegister: number;
  deactivateRegister: number;
  updatePromotion: number;
  createPromotion: number;
  exportTransactions: number;
  cashMovement: number;
  shiftReport: number;
  printReceipt: number;
  refund: number;
}

const defaultOrders = [
  {
    id: 1001,
    orderNumber: "POS-1001",
    status: "ready",
    tableNumber: "T01",
    customerName: "Alice",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    subtotal: 108,
    serviceCharge: 4,
    taxAmount: 8,
    discountAmount: 0,
    totalAmount: 120,
    paymentStatus: "unpaid",
    items: [
      {
        id: 11,
        menuItemName: "Roasted Noodles",
        quantity: 1,
        unitPrice: 108,
        totalPrice: 108,
      },
      {
        id: 12,
        menuItemName: "Drink",
        quantity: 1,
        unitPrice: 4,
        totalPrice: 4,
      },
      { id: 13, menuItemName: "Tax", quantity: 1, unitPrice: 8, totalPrice: 8 },
      {
        id: 14,
        menuItemName: "Service fee",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 4,
      },
    ],
  },
  {
    id: 1002,
    orderNumber: "POS-1002",
    status: "delivered",
    tableNumber: "T05",
    customerName: "Bob",
    createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    subtotal: 72,
    serviceCharge: 3,
    taxAmount: 4,
    discountAmount: 0,
    totalAmount: 79,
    paymentStatus: "unpaid",
    items: [
      {
        id: 21,
        menuItemName: "Soup",
        quantity: 1,
        unitPrice: 72,
        totalPrice: 72,
      },
      { id: 22, menuItemName: "Tax", quantity: 1, unitPrice: 4, totalPrice: 4 },
      {
        id: 23,
        menuItemName: "Service fee",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 3,
      },
    ],
  },
];

const defaultRegisters = [
  {
    id: "reg-front",
    name: "Front Counter",
    status: "active",
    currentBalance: 1200,
    todayTransactions: 10,
    lastActivity: new Date().toISOString(),
    location: "Entrance",
  },
  {
    id: "reg-takeout",
    name: "Takeout Desk",
    status: "inactive",
    currentBalance: 300,
    todayTransactions: 4,
    lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    location: "Left Wing",
  },
];

const defaultCurrentShift = {
  id: "shift-001",
  name: "Morning Shift",
  startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  endTime: "",
  operatorName: "Owner Main",
  registerId: "reg-front",
  operatorId: 1,
  startingCash: 1000,
  totalSales: 560,
  processedOrders: 8,
  status: "active",
};

const defaultDailyStats = {
  totalSales: 680,
  totalOrders: 12,
  avgServiceValue: 56.67,
};

const defaultTransactions = [
  {
    id: "txn-001",
    registerId: "reg-front",
    type: "sale",
    amount: 120,
    description: "Initial balance reconciliation",
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    operatorId: 1,
  },
];

const defaultPromotions = [
  {
    id: "promo-1",
    title: "Weekend Pack",
    description: "10% off dine-in",
    discountType: "percentage",
    discountValue: 10,
    isActive: true,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    conditions: "minAmount>=50",
  },
  {
    id: "promo-2",
    title: "Lunch Deal",
    description: "RM 5 off",
    discountType: "fixed_amount",
    discountValue: 5,
    isActive: false,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    conditions: "minAmount>=30",
  },
];

const defaultShiftReport = {
  shift: { id: "shift-001", name: "Morning Shift" },
  sales: 600,
  orders: 12,
  refunds: 0,
  cashMovements: [],
  receipts: [],
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

function mockPayload(result: MockRouteResult) {
  return {
    status: result.status,
    contentType: "application/json",
    body: JSON.stringify(result.body),
  };
}

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
    user: body.data!.user!,
  };
}

function setOwnerSession(page: Page, ctx: OwnerSession) {
  return page.addInitScript((payload) => {
    localStorage.setItem("auth_token", payload.token);
    if (payload.refreshToken) {
      localStorage.setItem("auth_refresh_token", payload.refreshToken);
    }
    localStorage.setItem("auth_user", JSON.stringify(payload.user));
    localStorage.setItem("makanmakan_locale", "en-US");
    localStorage.setItem("locale", "en-US");
    sessionStorage.clear();
  }, ctx);
}

async function openPOSCheckout(page: Page, ctx: OwnerSession) {
  await setOwnerSession(page, ctx);
  await page.goto(`${ADMIN_URL}/dashboard/pos/checkout`, {
    waitUntil: "networkidle",
  });
}

async function openPOSManagement(page: Page, ctx: OwnerSession) {
  await setOwnerSession(page, ctx);
  await page.goto(`${ADMIN_URL}/dashboard/pos/management`, {
    waitUntil: "networkidle",
  });
}

function installOwnerPOSMocks(
  page: Page,
  handlers: Partial<POSMockHandlers> = {},
) {
  const resolved: POSMockHandlers = {
    orders: handlers.orders ?? (() => successResponse(defaultOrders)),
    orderStatus:
      handlers.orderStatus ?? (() => successResponse({ success: true })),
    registers: handlers.registers ?? (() => successResponse(defaultRegisters)),
    currentShift:
      handlers.currentShift ?? (() => successResponse(defaultCurrentShift)),
    dailyRevenue:
      handlers.dailyRevenue ??
      (() => successResponse({ summary: { totalSales: 1320 } })),
    dailyStats:
      handlers.dailyStats ?? (() => successResponse(defaultDailyStats)),
    transactions:
      handlers.transactions ?? (() => successResponse(defaultTransactions)),
    promotions:
      handlers.promotions ?? (() => successResponse(defaultPromotions)),
    quickPayment:
      handlers.quickPayment ?? (() => successResponse({ success: true })),
    marketCheckoutPay:
      handlers.marketCheckoutPay ??
      (() =>
        successResponse({
          checkout: { id: "mc-checkout-1", paymentStatus: "paid" },
          payment: {
            status: "paid",
            method: "cash",
            totalAmountCents: 5000,
            paidAmountCents: 5000,
          },
        })),
    shiftStart:
      handlers.shiftStart ??
      (() =>
        successResponse({
          ...defaultCurrentShift,
          id: "shift-started",
          startTime: new Date().toISOString(),
        })),
    shiftEnd: handlers.shiftEnd ?? (() => successResponse({ success: true })),
    createRegister:
      handlers.createRegister ??
      (() =>
        successResponse({
          id: "reg-new",
          name: "New Register",
          status: "inactive",
        })),
    activateRegister:
      handlers.activateRegister ?? (() => successResponse({ success: true })),
    deactivateRegister:
      handlers.deactivateRegister ?? (() => successResponse({ success: true })),
    createPromotion:
      handlers.createPromotion ??
      (() =>
        successResponse({
          id: "promo-new",
          title: "New Promotion",
          isActive: true,
        })),
    updatePromotion:
      handlers.updatePromotion ?? (() => successResponse({ success: true })),
    exportTransactions:
      handlers.exportTransactions ?? (() => successResponse("trans-1,trans-2")),
    cashMovement:
      handlers.cashMovement ??
      (() =>
        successResponse({
          id: "txn-100",
          type: "cash_in",
        })),
    shiftReport:
      handlers.shiftReport ?? (() => successResponse(defaultShiftReport)),
    printReceipt:
      handlers.printReceipt ?? (() => successResponse({ id: "rct-001" })),
    refund: handlers.refund ?? (() => successResponse({ refunded: true })),
  };

  const stats: POSMockStats = {
    orders: 0,
    orderStatus: 0,
    registers: 0,
    currentShift: 0,
    dailyRevenue: 0,
    dailyStats: 0,
    transactions: 0,
    promotions: 0,
    quickPayment: 0,
    marketCheckoutPay: 0,
    shiftStart: 0,
    shiftEnd: 0,
    createRegister: 0,
    activateRegister: 0,
    deactivateRegister: 0,
    updatePromotion: 0,
    createPromotion: 0,
    exportTransactions: 0,
    cashMovement: 0,
    shiftReport: 0,
    printReceipt: 0,
    refund: 0,
  };

  page.route("**/api/v1/orders/*/status", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    stats.orderStatus += 1;
    await route.fulfill(mockPayload(resolved.orderStatus()));
  });

  page.route("**/api/v1/orders*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.orders += 1;
    await route.fulfill(mockPayload(resolved.orders()));
  });

  page.route("**/api/v1/pos/registers/*/stats/daily", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.dailyStats += 1;
    await route.fulfill(mockPayload(resolved.dailyStats()));
  });

  page.route("**/api/v1/pos/registers/*/cash-movements", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.transactions += 1;
    await route.fulfill(mockPayload(resolved.transactions()));
  });

  page.route("**/api/v1/pos/registers/*/activate", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.activateRegister += 1;
    await route.fulfill(mockPayload(resolved.activateRegister()));
  });

  page.route("**/api/v1/pos/registers/*/deactivate", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.deactivateRegister += 1;
    await route.fulfill(mockPayload(resolved.deactivateRegister()));
  });

  page.route("**/api/v1/pos/registers", async (route) => {
    if (route.request().method() === "POST") {
      stats.createRegister += 1;
      await route.fulfill(mockPayload(resolved.createRegister()));
      return;
    }
    if (route.request().method() !== "GET") return route.continue();
    stats.registers += 1;
    await route.fulfill(mockPayload(resolved.registers()));
  });

  page.route("**/api/v1/pos/shifts/current/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.currentShift += 1;
    await route.fulfill(mockPayload(resolved.currentShift()));
  });

  page.route("**/api/v1/pos/shifts/start", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.shiftStart += 1;
    await route.fulfill(mockPayload(resolved.shiftStart()));
  });

  page.route("**/api/v1/pos/shifts/*/end", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.shiftEnd += 1;
    await route.fulfill(mockPayload(resolved.shiftEnd()));
  });

  page.route("**/api/v1/pos/shifts/*/report", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.shiftReport += 1;
    await route.fulfill(mockPayload(resolved.shiftReport()));
  });

  page.route("**/api/v1/pos/reports/daily", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.dailyRevenue += 1;
    await route.fulfill(mockPayload(resolved.dailyRevenue()));
  });

  page.route("**/api/v1/pos/reports/export", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.exportTransactions += 1;
    await route.fulfill(mockPayload(resolved.exportTransactions()));
  });

  page.route("**/api/v1/pos/quick-payment", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.quickPayment += 1;
    await route.fulfill(mockPayload(resolved.quickPayment()));
  });

  page.route("**/api/v1/pos/market-checkouts/*/pay", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.marketCheckoutPay += 1;
    await route.fulfill(mockPayload(resolved.marketCheckoutPay()));
  });

  page.route("**/api/v1/pos/refunds/create", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.refund += 1;
    await route.fulfill(mockPayload(resolved.refund()));
  });

  page.route("**/api/v1/pos/receipts/print", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.printReceipt += 1;
    await route.fulfill(mockPayload(resolved.printReceipt()));
  });

  page.route("**/api/v1/pos/promotions", async (route) => {
    if (route.request().method() === "POST") {
      stats.createPromotion += 1;
      await route.fulfill(mockPayload(resolved.createPromotion()));
      return;
    }
    if (route.request().method() !== "GET") return route.continue();
    stats.promotions += 1;
    await route.fulfill(mockPayload(resolved.promotions()));
  });

  page.route("**/api/v1/pos/shifts/*/cash-movements", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    stats.cashMovement += 1;
    await route.fulfill(mockPayload(resolved.cashMovement()));
    return;
  });

  page.route("**/api/v1/pos/promotions/*", async (route) => {
    if (route.request().method() === "PUT") {
      stats.updatePromotion += 1;
      await route.fulfill(mockPayload(resolved.updatePromotion()));
      return;
    }
    return route.continue();
  });

  return {
    stats,
    restore: () => {
      page.unroute("**/api/v1/orders/*/status");
      page.unroute("**/api/v1/orders*");
      page.unroute("**/api/v1/pos/registers/*/stats/daily");
      page.unroute("**/api/v1/pos/registers/*/cash-movements");
      page.unroute("**/api/v1/pos/registers/*/activate");
      page.unroute("**/api/v1/pos/registers/*/deactivate");
      page.unroute("**/api/v1/pos/registers");
      page.unroute("**/api/v1/pos/shifts/current/*");
      page.unroute("**/api/v1/pos/shifts/start");
      page.unroute("**/api/v1/pos/shifts/*/end");
      page.unroute("**/api/v1/pos/shifts/*/report");
      page.unroute("**/api/v1/pos/reports/daily");
      page.unroute("**/api/v1/pos/reports/export");
      page.unroute("**/api/v1/pos/quick-payment");
      page.unroute("**/api/v1/pos/market-checkouts/*/pay");
      page.unroute("**/api/v1/pos/refunds/create");
      page.unroute("**/api/v1/pos/receipts/print");
      page.unroute("**/api/v1/pos/promotions/*");
      page.unroute("**/api/v1/pos/promotions");
      page.unroute("**/api/v1/pos/shifts/*/cash-movements");
    },
  };
}

async function waitForCheckoutReady(page: Page) {
  await expect(
    page.getByRole("heading", { name: /POS System/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Pending Orders/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Today's Performance/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Register Management/i }),
  ).toBeVisible();
}

async function waitForManagementReady(page: Page) {
  await expect(
    page.getByRole("heading", { name: /POS System/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Register List/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Today's Revenue/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Recent Transactions/i }),
  ).toBeVisible();
}

function cardByHeader(page: Page, heading: RegExp | string) {
  return page
    .getByRole("heading", { name: heading })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
}

test.describe("Smoke: owner POS usage-state workflows (owner role)", () => {
  test.beforeEach(async () => {
    test.skip(
      !AUTH_USERNAME || !AUTH_PASSWORD,
      "Owner credentials are not configured",
    );
  });

  test("1) Owner can enter POS Checkout and verify baseline UI", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);
    await expect(page).toHaveURL(/\/dashboard\/pos\/checkout/);
    await expect(page.getByRole("link", { name: /Checkout/i })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Shift Report/i }),
    ).toBeVisible();
  });

  test("2) Owner sees pending orders and can inspect order details", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);
    await expect(page.getByText("POS-1001")).toBeVisible();
    await expect(page.getByText("POS-1002")).toBeVisible();
    await expect(mocks.stats.orders).toBeGreaterThan(0);

    await page.getByText("POS-1001").click();
    await expect(
      page.getByRole("heading", { name: /Order Details/i }),
    ).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("T01")).toBeVisible();
  });

  test("3) Owner can filter checkout orders by keyword", async ({ page }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);

    const search = page.getByPlaceholder(/Search orders/);
    await search.fill("T05");
    await expect(page.getByText("POS-1002")).toBeVisible();
    await expect(page.getByText("POS-1001")).toHaveCount(0);
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test("4) Owner payment button is disabled unless minimum cash amount is reached", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    const payButton = page.getByTestId("pay-btn");
    await expect(payButton).toBeDisabled();
    await page.getByTestId("received-amount").fill("119");
    await expect(payButton).toBeDisabled();
    await page.getByTestId("received-amount").fill("120");
    await expect(payButton).toBeEnabled();
  });

  test("5) Owner completes checkout payment and clears the order from pending list", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    await page.getByTestId("received-amount").fill("150");
    await page.getByTestId("pay-btn").click();

    await expect(page.getByTestId("payment-success")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Payment Successful!/i }),
    ).toBeVisible();
    await expect(mocks.stats.orderStatus).toBe(1);
    await expect(mocks.stats.quickPayment).toBe(1);
    await page.getByRole("button", { name: /Done/i }).click();
    await expect(page.getByTestId("payment-success")).toBeHidden();
    await expect(page.getByText("POS-1001")).toHaveCount(0);
  });

  test("6) Owner gets order-level error when order status update fails, while order stays pending", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page, {
      orderStatus: () => failureResponse("force status update failure"),
    });
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    await page.getByTestId("received-amount").fill("150");
    await page.getByTestId("pay-btn").click();

    await expect(page.getByTestId("payment-error")).toBeVisible();
    await expect(mocks.stats.orderStatus).toBe(1);
    await expect(mocks.stats.quickPayment).toBe(0);
    await expect(page.getByText("POS-1001")).toBeVisible();
  });

  test("7) Owner still completes checkout payment if POS quick-payment fails after status update", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page, {
      quickPayment: () => failureResponse("quick payment tracking failed"),
    });
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    await page.getByTestId("received-amount").fill("150");
    await page.getByTestId("pay-btn").click();

    await expect(page.getByTestId("payment-success")).toBeVisible();
    await expect(mocks.stats.orderStatus).toBe(1);
    await expect(mocks.stats.quickPayment).toBe(1);
    await page.getByRole("button", { name: /Done/i }).click();
    await expect(page.getByText("POS-1001")).toHaveCount(0);
  });

  test("8) Owner can open shift report from checkout (API used but UI remains stable on fallback", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);
    await expect(
      page.getByRole("button", { name: /Shift Report/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Shift Report/i }).click();
    await expect(
      page.getByRole("heading", { name: /Shift Report/i }),
    ).toBeVisible();
    await expect(mocks.stats.shiftReport).toBe(1);

    // close modal by clicking the overlay
    await page.mouse.click(10, 10);
    await expect(
      page.getByRole("heading", { name: /Shift Report/i }),
    ).toBeHidden();
  });

  test("9) Owner can issue receipt print from checkout order panel without crashing", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    await page.getByRole("button", { name: /Print Receipt/i }).click();

    await expect(mocks.stats.printReceipt).toBe(1);
    await expect(page.getByText("Order Details")).toBeVisible();
    await expect(page.getByText("POS-1001")).toBeVisible();
  });

  test("10) Owner sees No Pending Orders when orders API fails and keeps checkout structure", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page, {
      orders: () => failureResponse("orders failed"),
    });
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);
    await expect(page.getByText(/No Pending Orders/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Today's Revenue/i }),
    ).toBeVisible();
  });

  test("11) Owner can continue checkout when daily report API fails (graceful degradation)", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page, {
      dailyRevenue: () => failureResponse("daily report failed"),
    });
    await openPOSCheckout(page, session);
    await waitForCheckoutReady(page);
    await expect(page.getByText("POS-1001")).toBeVisible();
  });

  test("12) Owner can manually refresh checkout order list", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    let refreshRound = 0;
    const mocks = installOwnerPOSMocks(page, {
      orders: () => {
        refreshRound += 1;
        return successResponse(
          refreshRound > 1 ? [defaultOrders[1]] : defaultOrders,
        );
      },
    });
    await openPOSCheckout(page, session);
    await waitUntilCheckoutAndSelect(page, "POS-1001");
    const listCard = cardByHeader(page, /Pending Orders/i);
    await listCard.getByRole("button").nth(0).click();
    await expect(mocks.stats.orders).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("POS-1001")).toHaveCount(0);
  });

  test("13) Owner confirms /dashboard/pos navigates to Checkout by default", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await page.goto(`${ADMIN_URL}/dashboard/pos`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/pos\/checkout/);
    await waitForCheckoutReady(page);
  });

  test("14) Owner switches between checkout and management tabs and returns with state intact", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSCheckout(page, session);
    await page.getByRole("link", { name: /Register Management/i }).click();
    await waitForManagementReady(page);
    await page.getByRole("link", { name: /Checkout/i }).click();
    await waitForCheckoutReady(page);
    await expect(page.getByText("POS-1001")).toBeVisible();
  });

  test("15) Management page loads registers, current shift and daily KPI", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(page.getByText("Front Counter")).toBeVisible();
    await expect(page.getByText("Takeout Desk")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Today's Revenue/i }),
    ).toBeVisible();
    await expect(page.getByText("POS-1001", { exact: false })).toHaveCount(0);
    await expect(mocks.stats.currentShift).toBeGreaterThanOrEqual(1);
  });

  test("16) Management can activate an inactive register and keep action recoverable", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    const inactiveCard = cardByHeader(page, "Takeout Desk");
    await inactiveCard.getByRole("button", { name: /Activate/i }).click();
    await expect(mocks.stats.activateRegister).toBe(1);
    await expect(
      inactiveCard.getByRole("button", { name: /Deactivate/i }),
    ).toBeVisible();
  });

  test("17) Management start shift flow from no-shift state", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page, {
      currentShift: () => successResponse(null),
      shiftStart: () =>
        successResponse({
          ...defaultCurrentShift,
          id: "shift-boot",
          status: "active",
        }),
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(
      page.getByRole("button", { name: /Start Shift/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Start Shift/i }).click();
    const startShiftModal = page.locator("div.fixed.inset-0").filter({
      has: page.getByRole("heading", { name: /Start Shift/i }),
    });
    await expect(startShiftModal).toBeVisible();
    await startShiftModal.getByPlaceholder("0.00").fill("800");
    const confirm = startShiftModal.getByRole("button", {
      name: /^Start Shift$/,
    });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(mocks.stats.shiftStart).toBe(1);
    await expect(
      page.getByRole("button", { name: /End Shift/i }),
    ).toBeVisible();
  });

  test("18) Management can end an active shift and return to no-shift mode", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(
      page.getByRole("button", { name: /End Shift/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /End Shift/i }).click();
    const confirm = page.getByRole("button", { name: /End Shift/ }).last();
    await confirm.click();
    await expect(mocks.stats.shiftEnd).toBe(1);
  });

  test("19) Management quick payment records a transaction and refreshes recent list", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    let txnRound = 0;
    const mocks = installOwnerPOSMocks(page, {
      quickPayment: () => successResponse({ id: "qp-1" }),
      transactions: () => {
        txnRound += 1;
        if (txnRound === 1) {
          return successResponse(defaultTransactions);
        }
        return successResponse([
          ...defaultTransactions,
          {
            id: `txn-qp-${txnRound}`,
            registerId: "reg-front",
            type: "sale",
            amount: 120,
            description: `Quick payment POS-1001 #${txnRound}`,
            createdAt: new Date().toISOString(),
            operatorId: 1,
          },
        ]);
      },
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    const quickPaymentCard = cardByHeader(page, /Quick Payment/i);
    await quickPaymentCard
      .getByRole("textbox", { name: /Order Number/i })
      .fill("POS-1001");
    await quickPaymentCard.getByRole("spinbutton").fill("120");
    await quickPaymentCard.getByRole("combobox").selectOption("card");
    await quickPaymentCard
      .getByRole("button", { name: /Confirm Payment/i })
      .click();

    await expect(mocks.stats.quickPayment).toBe(1);
    await expect(mocks.stats.transactions).toBeGreaterThanOrEqual(2);
    await expect(
      quickPaymentCard.getByRole("textbox", { name: /Order Number/i }),
    ).toHaveValue("");
    await expect(page.getByText(/Quick payment POS-1001/)).toBeVisible();
  });

  test("20) Management quick payment failure preserves input for retry", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page, {
      quickPayment: () => failureResponse("quick payment fail"),
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    const quickPaymentCard = cardByHeader(page, /Quick Payment/i);
    await quickPaymentCard
      .getByRole("textbox", { name: /Order Number/i })
      .fill("POS-1001");
    await quickPaymentCard.getByRole("spinbutton").fill("99");
    await quickPaymentCard.getByRole("combobox").selectOption("cash");
    await quickPaymentCard
      .getByRole("button", { name: /Confirm Payment/i })
      .click();

    await expect(mocks.stats.quickPayment).toBe(1);
    await expect(
      quickPaymentCard.getByRole("textbox", { name: /Order Number/i }),
    ).toHaveValue("POS-1001");
  });

  test("21) Management market checkout success clears id and updates transactions", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);

    await page.getByTestId("pos-market-checkout-id").fill("MC-2026-001");
    await page
      .getByTestId("pos-market-checkout-payment-method")
      .selectOption("card");
    await page.getByTestId("pos-market-checkout-pay").click();

    await expect(mocks.stats.marketCheckoutPay).toBe(1);
    await expect(page.getByTestId("pos-market-checkout-id")).toHaveValue("");
  });

  test("22) Management market checkout failure keeps market checkout ID for retry", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page, {
      marketCheckoutPay: () => failureResponse("market checkout failed"),
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);

    await page.getByTestId("pos-market-checkout-id").fill("MC-ERR-01");
    await page
      .getByTestId("pos-market-checkout-payment-method")
      .selectOption("cash");
    await page.getByTestId("pos-market-checkout-pay").click();

    await expect(mocks.stats.marketCheckoutPay).toBe(1);
    await expect(page.getByTestId("pos-market-checkout-id")).toHaveValue(
      "MC-ERR-01",
    );
  });

  test("23) Management cash movement posts movement and refreshes transaction list", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    let movementCall = 0;
    const mocks = installOwnerPOSMocks(page, {
      transactions: () => {
        movementCall += 1;
        return successResponse(
          movementCall === 1
            ? defaultTransactions
            : [
                ...defaultTransactions,
                {
                  id: "txn-cm-2",
                  registerId: "reg-front",
                  type: "cash_in",
                  amount: 50,
                  description: "Drawer count",
                  createdAt: new Date().toISOString(),
                  operatorId: 1,
                },
              ],
        );
      },
      cashMovement: () =>
        successResponse({
          id: "cm-2",
          type: "cash_in",
          amount: 50,
          description: "Drawer count",
        }),
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    const frontRegisterCard = cardByHeader(page, "Front Counter");
    await frontRegisterCard
      .getByRole("button", { name: /Cash Management/i })
      .click();
    const cashMovementDialog = page
      .getByRole("heading", { name: /Cash Management/i })
      .locator("..")
      .locator("..");
    await expect(cashMovementDialog).toBeVisible();
    await cashMovementDialog.getByRole("combobox").selectOption("cash_in");
    await cashMovementDialog.getByRole("spinbutton").fill("50");
    await cashMovementDialog.getByLabel(/Description/).fill("Drawer count");
    await cashMovementDialog
      .getByRole("button", { name: /Confirm Operation/i })
      .click();

    await expect(mocks.stats.cashMovement).toBe(1);
    await expect(mocks.stats.transactions).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Drawer count")).toBeVisible();
  });

  test("24) Management can open promotions management and toggle promotion state", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await page.getByRole("button", { name: /Promotion Management/i }).click();
    await expect(
      page.getByRole("heading", { name: /Promotion Management/i }),
    ).toBeVisible();
    const lunchCard = page
      .getByRole("heading", { name: "Lunch Deal" })
      .locator("xpath=ancestor::div[contains(@class,'border')][1]");
    await lunchCard.getByRole("button", { name: /Enable/i }).click();
    await expect(mocks.stats.updatePromotion).toBe(1);
    await expect(lunchCard.getByText(/Enabled/)).toBeVisible();
  });

  test("25) Management export API is triggered via export transactions action", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await page.getByRole("button", { name: /^Export$/i }).click();
    await expect(mocks.stats.exportTransactions).toBe(1);
  });

  test("26) Management single promotions API failure keeps page core controls usable", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page, {
      promotions: () => failureResponse("promotion failed"),
    });
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(page.getByText("Front Counter")).toBeVisible();
    await expect(page.getByText(/No active promotions/i)).toBeVisible();
  });

  test("27) All POS APIs fail in one state, then recover after reload+re-mock", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const broken = installOwnerPOSMocks(page, {
      orders: () => failureResponse("all fail"),
      registers: () => failureResponse("all fail"),
      currentShift: () => failureResponse("all fail"),
      dailyRevenue: () => failureResponse("all fail"),
      dailyStats: () => failureResponse("all fail"),
      transactions: () => failureResponse("all fail"),
      promotions: () => failureResponse("all fail"),
      quickPayment: () => failureResponse("all fail"),
      marketCheckoutPay: () => failureResponse("all fail"),
      shiftStart: () => failureResponse("all fail"),
      shiftEnd: () => failureResponse("all fail"),
    });

    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(page).toHaveURL(/\/dashboard\/pos\/management/);
    await expect(page.getByText("Register List")).toBeVisible();

    broken.restore();
    const recovered = installOwnerPOSMocks(page);
    await page.reload();
    await waitForManagementReady(page);
    await expect(recovered.stats.orders).toBeGreaterThan(0);
    await expect(page.getByText("Front Counter")).toBeVisible();
  });

  test("28) Management supports 30-second polling cadence for recent transactions", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    let round = 0;
    const mocks = installOwnerPOSMocks(page, {
      transactions: () => {
        round += 1;
        return successResponse([
          ...defaultTransactions,
          {
            id: `txn-poll-${round}`,
            registerId: "reg-front",
            type: "sale",
            amount: 100 + round,
            description: `Poll ${round}`,
            createdAt: new Date().toISOString(),
            operatorId: 1,
          },
        ]);
      },
    });

    await page.clock().install();
    await page.addInitScript(() => {
      window.setInterval(() => {
        const refreshBtn = document.querySelector(
          '[data-testid="refresh-btn"]',
        ) as HTMLButtonElement | null;
        if (refreshBtn) {
          refreshBtn.click();
        }
      }, 30_000);
    });

    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(mocks.stats.transactions).toBeGreaterThanOrEqual(1);
    await page.clock().fastForward(90_000);
    await expect
      .poll(() => mocks.stats.transactions, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(4);
  });

  test("29) Management to checkout tab and browser back keeps owner session/role", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await page.getByRole("link", { name: /Checkout/i }).click();
    await waitForCheckoutReady(page);
    await page.goBack();
    await waitForManagementReady(page);
    await expect(page).toHaveURL(/\/dashboard\/pos\/management/);
    await expect(page.getByText("Front Counter")).toBeVisible();
  });

  test("30) Management single transaction-list API failure is recoverable via manual refresh", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    let transactionsTry = 0;
    const mocks = installOwnerPOSMocks(page, {
      transactions: () => {
        transactionsTry += 1;
        if (transactionsTry === 1) {
          return failureResponse("temporary tx failure");
        }

        return successResponse([
          ...defaultTransactions,
          {
            id: "txn-recover",
            registerId: "reg-front",
            type: "refund",
            amount: 25,
            description: "Recovered by manual retry",
            createdAt: new Date().toISOString(),
            operatorId: 1,
          },
        ]);
      },
    });

    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(mocks.stats.transactions).toBe(1);
    await page.getByTestId("refresh-btn").first().click();
    await expect(mocks.stats.transactions).toBe(2);
    await expect(
      page.getByRole("heading", { name: /Recent Transactions/i }),
    ).toBeVisible();
    await expect(page.getByText("Recovered by manual retry")).toBeVisible();
  });

  test("31) All POS APIs fail once, then retry in-place recovers without full page reload", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const broken = installOwnerPOSMocks(page, {
      orders: () => failureResponse("all fail"),
      registers: () => failureResponse("all fail"),
      currentShift: () => failureResponse("all fail"),
      dailyRevenue: () => failureResponse("all fail"),
      dailyStats: () => failureResponse("all fail"),
      transactions: () => failureResponse("all fail"),
      promotions: () => failureResponse("all fail"),
      quickPayment: () => failureResponse("all fail"),
      marketCheckoutPay: () => failureResponse("all fail"),
      shiftStart: () => failureResponse("all fail"),
      shiftEnd: () => failureResponse("all fail"),
    });

    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await expect(page.getByText(/Register List/i)).toBeVisible();
    await expect(page.getByText("Front Counter")).toHaveCount(0);

    broken.restore();
    const recovered = installOwnerPOSMocks(page);
    await page.getByTestId("refresh-btn").first().click();
    await expect(recovered.stats.currentShift).toBeGreaterThanOrEqual(1);
    await expect(page.getByText("Front Counter")).toBeVisible();
    await expect(page.getByText("Takeout Desk")).toBeVisible();
  });

  test("32) Quick navigation sequence preserves owner session while switching routes", async ({
    page,
  }) => {
    const session = await loginOwnerSession();
    const mocks = installOwnerPOSMocks(page);
    await openPOSManagement(page, session);
    await waitForManagementReady(page);
    await page.getByRole("link", { name: /Checkout/i }).click();
    await waitForCheckoutReady(page);
    await page.getByText("POS-1001").click();
    await expect(
      page.getByRole("heading", { name: /Order Details/i }),
    ).toBeVisible();

    await page.goto(`${ADMIN_URL}/dashboard/settings`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/dashboard\/settings/);

    await page.goBack();
    await waitForCheckoutReady(page);
    await expect(page.getByText("POS-1001")).toBeVisible();

    await page.goBack();
    await waitForManagementReady(page);
    await expect(page).toHaveURL(/\/dashboard\/pos\/management/);
    await expect(page.getByText("Front Counter")).toBeVisible();
    await expect(mocks.stats.currentShift).toBeGreaterThanOrEqual(1);
  });
});

async function waitUntilCheckoutAndSelect(page: Page, orderNumber: string) {
  await waitForCheckoutReady(page);
  await expect(page.getByText(orderNumber)).toBeVisible();
  await page.getByText(orderNumber).click();
  await expect(
    page.getByRole("heading", { name: /Order Details/i }),
  ).toBeVisible();
}
