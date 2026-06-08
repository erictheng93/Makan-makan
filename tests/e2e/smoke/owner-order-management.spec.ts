import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getSmokeOwnerSession,
  hasSmokeOwnerCredentials,
  setSmokeOwnerSession,
  type SmokeOwnerSession,
} from "./owner-auth";

const ADMIN_URL = process.env.SMOKE_ADMIN_URL || "http://localhost:3001";

const LABELS = {
  heading: /Order List/i,
  searchPlaceholder: /Search order number or customer/i,
  refreshButton: /Refresh/i,
  noDataTitle: /No Orders/i,
  noDataSubtitle: /No orders match/i,
  pending: /Pending/i,
  preparing: /Preparing/i,
  completed: /Completed/i,
  cancelled: /Cancelled/i,
  detail: /Order Detail/i,
  deliveryInfo: /Delivery Info/i,
  totalAmount: /Total Amount/i,
};

type OwnerContext = SmokeOwnerSession;

interface MockRouteResult {
  status: number;
  body: unknown;
}

interface OrderMockHandlers {
  orders: () => MockRouteResult;
  orderStatus: () => MockRouteResult;
  orderCancel: () => MockRouteResult;
}

interface OrderMockStats {
  orders: number;
  orderStatus: number;
  orderCancel: number;
}

type DeliveryOrderType = "dine_in" | "takeaway" | "delivery";

interface OrderItemFixture {
  id: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  menuItem?: {
    id: number;
    name: string;
  };
}

interface OrderFixture {
  id: number;
  tableId?: number;
  status: string;
  orderSource?: "direct" | "market_checkout" | "uber_eats" | "foodpanda";
  totalAmount: number;
  items: OrderItemFixture[];
  notes?: string;
  customerInfo?: {
    name: string;
  };
  deliveryInfo?: {
    type: DeliveryOrderType;
    address?: string;
    phone?: string;
    instructions?: string;
    deliveryFee?: number;
  };
  createdAt: string;
  updatedAt: string;
}

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

const baseTime = Date.now();

function minutesAgo(minutes: number) {
  return new Date(baseTime - minutes * 60 * 1000).toISOString();
}

const defaultOrders: OrderFixture[] = [
  {
    id: 110001,
    tableId: 1,
    status: "pending",
    orderSource: "direct",
    totalAmount: 145,
    customerInfo: { name: "Alice Chen" },
    items: [
      {
        id: 301,
        menuItemId: 101,
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        menuItem: { id: 101, name: "Chicken Soup" },
      },
      {
        id: 302,
        menuItemId: 102,
        quantity: 1,
        unitPrice: 45,
        totalPrice: 45,
        menuItem: { id: 102, name: "Green Salad" },
      },
    ],
    createdAt: minutesAgo(1),
    updatedAt: minutesAgo(1),
  },
  {
    id: 110002,
    tableId: 4,
    status: "confirmed",
    orderSource: "market_checkout",
    totalAmount: 200,
    customerInfo: { name: "Ben Liu" },
    items: [
      {
        id: 303,
        menuItemId: 103,
        quantity: 1,
        unitPrice: 120,
        totalPrice: 120,
        menuItem: { id: 103, name: "Steak Plate" },
      },
      {
        id: 304,
        menuItemId: 104,
        quantity: 2,
        unitPrice: 40,
        totalPrice: 80,
        menuItem: { id: 104, name: "Tea" },
      },
    ],
    createdAt: minutesAgo(3),
    updatedAt: minutesAgo(2),
  },
  {
    id: 110003,
    status: "preparing",
    orderSource: "uber_eats",
    totalAmount: 98,
    customerInfo: { name: "Cindy Wu" },
    items: [
      {
        id: 305,
        menuItemId: 105,
        quantity: 1,
        unitPrice: 98,
        totalPrice: 98,
        menuItem: { id: 105, name: "Pasta" },
      },
    ],
    createdAt: minutesAgo(6),
    updatedAt: minutesAgo(5),
  },
  {
    id: 110004,
    tableId: 5,
    status: "ready",
    orderSource: "foodpanda",
    totalAmount: 75,
    customerInfo: { name: "David Kao" },
    items: [
      {
        id: 306,
        menuItemId: 106,
        quantity: 3,
        unitPrice: 25,
        totalPrice: 75,
        menuItem: { id: 106, name: "Coffee" },
      },
    ],
    createdAt: minutesAgo(10),
    updatedAt: minutesAgo(8),
  },
  {
    id: 110005,
    tableId: 7,
    status: "delivered",
    orderSource: "market_checkout",
    totalAmount: 188,
    customerInfo: { name: "Ella Lin" },
    deliveryInfo: {
      type: "delivery",
      address: "No. 12, Market Road",
      phone: "0911122334",
      deliveryFee: 15,
      instructions: "Call on arrival",
    },
    items: [
      {
        id: 307,
        menuItemId: 107,
        quantity: 1,
        unitPrice: 90,
        totalPrice: 90,
        menuItem: { id: 107, name: "Fruit Cake" },
      },
      {
        id: 308,
        menuItemId: 108,
        quantity: 2,
        unitPrice: 49,
        totalPrice: 98,
        menuItem: { id: 108, name: "Water" },
      },
    ],
    createdAt: minutesAgo(16),
    updatedAt: minutesAgo(15),
  },
  {
    id: 110006,
    tableId: 8,
    status: "paid",
    orderSource: "foodpanda",
    totalAmount: 64,
    customerInfo: { name: "Frank Lin" },
    items: [
      {
        id: 309,
        menuItemId: 109,
        quantity: 1,
        unitPrice: 64,
        totalPrice: 64,
        menuItem: { id: 109, name: "Noodle Soup" },
      },
    ],
    createdAt: minutesAgo(20),
    updatedAt: minutesAgo(19),
  },
  {
    id: 110007,
    tableId: 9,
    status: "cancelled",
    orderSource: "direct",
    totalAmount: 50,
    customerInfo: { name: "Gina Huang" },
    items: [
      {
        id: 310,
        menuItemId: 110,
        quantity: 1,
        unitPrice: 50,
        totalPrice: 50,
        menuItem: { id: 110, name: "Pancake" },
      },
    ],
    createdAt: minutesAgo(30),
    updatedAt: minutesAgo(29),
  },
];

function cloneOrders(orders: OrderFixture[]) {
  return JSON.parse(JSON.stringify(orders)) as OrderFixture[];
}

function formatOrderNumber(id: number) {
  return `ORD-${id.toString().padStart(6, "0")}`;
}

function installOwnerOrderMocks(
  page: Page,
  handlers: Partial<OrderMockHandlers> = {},
) {
  const resolved = {
    orders: handlers.orders ?? (() => successResponse(defaultOrders)),
    orderStatus:
      handlers.orderStatus ?? (() => successResponse({ success: true })),
    orderCancel:
      handlers.orderCancel ?? (() => successResponse({ success: true })),
  } satisfies Record<keyof OrderMockHandlers, () => MockRouteResult>;

  const stats: OrderMockStats = {
    orders: 0,
    orderStatus: 0,
    orderCancel: 0,
  };

  page.route("**/api/v1/orders/*/status", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    stats.orderStatus += 1;
    await route.fulfill(mockPayload(resolved.orderStatus()));
  });

  page.route("**/api/v1/orders/*", async (route) => {
    if (route.request().method() === "DELETE") {
      stats.orderCancel += 1;
      await route.fulfill(mockPayload(resolved.orderCancel()));
      return;
    }
    return route.continue();
  });

  page.route("**/api/v1/orders*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    stats.orders += 1;
    await route.fulfill(mockPayload(resolved.orders()));
  });

  return {
    stats,
    restore: () => {
      page.unroute("**/api/v1/orders/*/status");
      page.unroute("**/api/v1/orders/*");
      page.unroute("**/api/v1/orders*");
    },
  };
}

async function openOwnerOrders(page: Page, ctx: OwnerContext) {
  await setSmokeOwnerSession(page, ctx);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${ADMIN_URL}/dashboard/orders`, {
    waitUntil: "networkidle",
  });
}

async function openOwnerOrdersWithFastPoll(
  page: Page,
  ctx: OwnerContext,
  fastIntervalMs: number,
) {
  await page.addInitScript((ms) => {
    const originalSetInterval = window.setInterval;
    window.setInterval = ((handler, timeout, ...args) => {
      const safeTimeout = timeout ?? 0;
      if (safeTimeout === 30_000) {
        return originalSetInterval(handler, ms, ...args);
      }
      return originalSetInterval(handler, safeTimeout, ...args);
    }) as typeof window.setInterval;
  }, fastIntervalMs);

  await openOwnerOrders(page, ctx);

  await page.evaluate(() => {
    const refreshButton = Array.from(document.querySelectorAll("button")).find(
      (el) => (el.textContent ?? "").trim() === "Refresh",
    );
    if (refreshButton instanceof HTMLButtonElement) {
      window.setInterval(() => refreshButton.click(), 30_000);
    }
  });
}

async function waitForOrdersReady(page: Page) {
  await expect(
    page.getByRole("heading", { name: LABELS.heading }),
  ).toBeVisible();
  await expect(page.getByPlaceholder(LABELS.searchPlaceholder)).toBeVisible();
  await expect(
    page.getByRole("button", { name: LABELS.refreshButton }),
  ).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: LABELS.pending }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.preparing }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.completed }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: LABELS.cancelled }),
  ).toBeVisible();
}

function orderCards(page: Page) {
  return page.locator(
    "div.lg\\:hidden div.border.border-gray-200.rounded-lg.p-4",
  );
}

function orderCardByNumber(page: Page, orderNumber: string) {
  return orderCards(page).filter({ hasText: orderNumber });
}

function orderCardByNumberText(page: Page, orderNumber: string) {
  return orderCards(page)
    .filter({ hasText: orderNumber })
    .locator("span", { hasText: orderNumber })
    .first();
}

function orderCardsLoadingText(page: Page, phrase: string | RegExp) {
  return page.locator("h3", { hasText: phrase }).first();
}

function getDetailModal(page: Page) {
  return page.locator("div.relative.bg-white.rounded-lg.shadow-xl.max-w-2xl");
}

async function closeOrderDetailModal(detailModal: Locator) {
  const closeButton = detailModal.getByRole("button").first();
  await closeButton.click();
  await expect(detailModal).toBeHidden();
}

async function openOrderDetail(page: Page, orderNumber: string) {
  const target = orderCardByNumber(page, orderNumber);
  await expect(target).toBeVisible();
  await target.getByRole("button", { name: /View/i }).click();
}

test.describe("Smoke: owner order management workflows (owner role)", () => {
  test.beforeEach(async () => {
    test.skip(
      !hasSmokeOwnerCredentials,
      "Owner credentials or admin URL is not configured",
    );
  });

  test("1) Owner can enter orders page and see baseline UI", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(defaultOrders.length);
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110001)),
    ).toBeVisible();
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110007)),
    ).toBeVisible();
  });

  test("2) KPI cards render from mocked status distribution", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(
      page
        .getByRole("heading", { name: LABELS.pending })
        .locator("xpath=following-sibling::p[1]"),
    ).toHaveText("2");
    await expect(
      page
        .getByRole("heading", { name: LABELS.preparing })
        .locator("xpath=following-sibling::p[1]"),
    ).toHaveText("3");
    await expect(
      page
        .getByRole("heading", { name: LABELS.completed })
        .locator("xpath=following-sibling::p[1]"),
    ).toHaveText("2");
    await expect(
      page
        .getByRole("heading", { name: LABELS.cancelled })
        .locator("xpath=following-sibling::p[1]"),
    ).toHaveText("1");
  });

  test("3) Owner can search by exact order number", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    await page.getByPlaceholder(LABELS.searchPlaceholder).fill("ORD-110003");
    await expect(orderCards(page)).toHaveCount(1);
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110003)),
    ).toBeVisible();
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110002)),
    ).toHaveCount(0);
  });

  test("4) Owner can search by customer name", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const search = page.getByPlaceholder(LABELS.searchPlaceholder);
    await search.fill("Alice");
    await expect(
      orderCardByNumber(page, formatOrderNumber(110001)),
    ).toBeVisible();
    await expect(
      orderCardByNumber(page, formatOrderNumber(110002)),
    ).toHaveCount(0);
  });

  test("5) Owner can filter by order status", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const statusFilter = page.getByRole("combobox").nth(0);
    await statusFilter.selectOption("preparing");
    await expect(orderCards(page)).toHaveCount(1);
    await expect(
      orderCardByNumber(page, formatOrderNumber(110003)),
    ).toBeVisible();
    await expect(
      orderCardByNumber(page, formatOrderNumber(110001)),
    ).toHaveCount(0);
  });

  test("6) Owner can filter by order type", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const typeFilter = page.getByRole("combobox").nth(1);
    await typeFilter.selectOption("takeaway");
    await expect(orderCards(page)).toHaveCount(1);
    await expect(
      orderCardByNumber(page, formatOrderNumber(110003)),
    ).toBeVisible();
  });

  test("7) Owner can filter by order source", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const sourceFilter = page.getByRole("combobox").nth(2);
    await sourceFilter.selectOption("market_checkout");
    await expect(orderCards(page)).toHaveCount(2);
    await expect(
      orderCardByNumber(page, formatOrderNumber(110002)),
    ).toBeVisible();
    await expect(
      orderCardByNumber(page, formatOrderNumber(110005)),
    ).toBeVisible();
    await expect(
      orderCardByNumber(page, formatOrderNumber(110007)),
    ).toHaveCount(0);
  });

  test("8) Owner can combine filters to narrow to a single order", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const statusFilter = page.getByRole("combobox").nth(0);
    const typeFilter = page.getByRole("combobox").nth(1);
    const sourceFilter = page.getByRole("combobox").nth(2);
    await statusFilter.selectOption("ready");
    await typeFilter.selectOption("dine_in");
    await sourceFilter.selectOption("foodpanda");
    await expect(orderCards(page)).toHaveCount(1);
    await expect(
      orderCardByNumber(page, formatOrderNumber(110004)),
    ).toBeVisible();
  });

  test("9) Owner can clear filter state back to full order list", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const statusFilter = page.getByRole("combobox").nth(0);
    const typeFilter = page.getByRole("combobox").nth(1);
    const sourceFilter = page.getByRole("combobox").nth(2);
    await statusFilter.selectOption("pending");
    await typeFilter.selectOption("dine_in");
    await sourceFilter.selectOption("direct");
    await expect(orderCards(page)).toHaveCount(1);

    await statusFilter.selectOption("");
    await expect(orderCards(page)).toHaveCount(2);

    await typeFilter.selectOption("");
    await expect(orderCards(page)).toHaveCount(2);

    await sourceFilter.selectOption("");
    await expect(orderCards(page)).toHaveCount(defaultOrders.length);
  });

  test("10) Owner can view order detail and close modal", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    await openOrderDetail(page, formatOrderNumber(110001));
    const detailModal = getDetailModal(page);
    await expect(
      detailModal.getByRole("heading", { name: /Order Detail - ORD-110001/i }),
    ).toBeVisible();
    await expect(detailModal.getByText("Alice Chen")).toBeVisible();
    await expect(detailModal.getByText("Chicken Soup")).toBeVisible();
    await closeOrderDetailModal(detailModal);
  });

  test("11) Owner sees delivery info in detail for delivery orders", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    await openOrderDetail(page, formatOrderNumber(110005));
    const detailModal = getDetailModal(page);
    await expect(
      detailModal.getByRole("heading", { name: /Order Detail - ORD-110005/i }),
    ).toBeVisible();
    await expect(detailModal.getByText(LABELS.deliveryInfo)).toBeVisible();
    await expect(detailModal.getByText("No. 12, Market Road")).toBeVisible();
    await expect(detailModal.getByText("0911122334")).toBeVisible();
    await expect(detailModal.getByText("Call on arrival")).toBeVisible();
    await expect(detailModal.getByText("NT$15").first()).toBeVisible();
    await closeOrderDetailModal(detailModal);
  });

  test("12) Owner can jump from order item to menu with highlightItem query", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    await openOrderDetail(page, formatOrderNumber(110001));
    await page.getByText("Green Salad").click();
    await expect(page).toHaveURL(/\/dashboard\/menu\?.*highlightItem=102/);
    await page.goBack();
    await waitForOrdersReady(page);
  });

  test("13) Owner can update a pending order to confirmed", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    const sharedOrders = cloneOrders(defaultOrders);
    const mocks = installOwnerOrderMocks(page, {
      orders: () => successResponse(sharedOrders),
      orderStatus: () => {
        const target = sharedOrders.find((order) => order.id === 110001);
        if (target) target.status = "confirmed";
        return successResponse({ success: true });
      },
    });

    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    const card = orderCardByNumber(page, formatOrderNumber(110001));
    await expect(card.getByRole("button", { name: /Update/i })).toBeVisible();
    await card.getByRole("button", { name: /Update/i }).click();
    await expect(mocks.stats.orderStatus).toBe(1);
    await expect(card).toContainText(/Confirmed/);
    await expect(card.getByRole("button", { name: /Update/i })).toBeVisible();
  });

  test("14) Update action failure keeps order status stable", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page, {
      orderStatus: () => failureResponse("status update failed"),
    });
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    const card = orderCardByNumber(page, formatOrderNumber(110001));
    await expect(card).toContainText(/Pending/);
    await card.getByRole("button", { name: /Update/i }).click();
    await expect(card).toContainText(/Pending/);
    await expect(card.getByRole("button", { name: /Update/i })).toBeVisible();
  });

  test("15) Owner can cancel a pending order with confirmation", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    const sharedOrders = cloneOrders(defaultOrders);
    const mocks = installOwnerOrderMocks(page, {
      orders: () => successResponse(sharedOrders),
      orderCancel: () => {
        const target = sharedOrders.find((order) => order.id === 110002);
        if (target) target.status = "cancelled";
        return successResponse({ success: true });
      },
    });

    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    const card = orderCardByNumber(page, formatOrderNumber(110002));
    await card.getByRole("button", { name: /Cancel/i }).click();

    const modal = page.locator("div.fixed.inset-0.z-50");
    await expect(modal).toBeVisible();
    await modal.getByRole("button").nth(1).click();

    await expect(mocks.stats.orderCancel).toBe(1);
    await expect(card).toContainText(/Cancelled/);
    await expect(card.getByRole("button", { name: /Cancel/i })).toHaveCount(0);
    await expect(mocks.stats.orders).toBeGreaterThan(1);
  });

  test("16) Cancel flow can be aborted via confirm modal", async ({ page }) => {
    const session = await getSmokeOwnerSession();
    const sharedOrders = cloneOrders(defaultOrders);
    const mocks = installOwnerOrderMocks(page, {
      orders: () => successResponse(sharedOrders),
      orderCancel: () => {
        const target = sharedOrders.find((order) => order.id === 110002);
        if (target) target.status = "cancelled";
        return successResponse({ success: true });
      },
    });
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    const card = orderCardByNumber(page, formatOrderNumber(110002));
    await card.getByRole("button", { name: /Cancel/i }).click();

    const modal = page.locator("div.fixed.inset-0.z-50");
    await expect(modal).toBeVisible();
    await modal.getByRole("button").first().click();

    await expect(mocks.stats.orderCancel).toBe(0);
    await expect(card).toContainText(/Confirmed/);
  });

  test("17) Completed and cancelled orders should hide unavailable actions", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    const deliveredCard = orderCardByNumber(page, formatOrderNumber(110005));
    await expect(
      deliveredCard.getByRole("button", { name: /Update/i }),
    ).toHaveCount(0);
    await expect(
      deliveredCard.getByRole("button", { name: /Cancel/i }),
    ).toHaveCount(0);

    const cancelledCard = orderCardByNumber(page, formatOrderNumber(110007));
    await expect(
      cancelledCard.getByRole("button", { name: /Update/i }),
    ).toHaveCount(0);
    await expect(
      cancelledCard.getByRole("button", { name: /Cancel/i }),
    ).toHaveCount(0);
  });

  test("18) Single order-list API failure keeps UI controls usable", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page, {
      orders: () => failureResponse("orders failed"),
    });

    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(0);
    await expect(orderCardsLoadingText(page, LABELS.noDataTitle)).toBeVisible();
    await expect(
      page.locator("p", { hasText: LABELS.noDataSubtitle }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: LABELS.refreshButton }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(LABELS.searchPlaceholder)).toBeVisible();
  });

  test("19) Empty result returns empty state with placeholder", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page, { orders: () => successResponse([]) });
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(0);
    await expect(orderCardsLoadingText(page, LABELS.noDataTitle)).toBeVisible();
    await expect(
      page.locator("p", { hasText: LABELS.noDataSubtitle }).first(),
    ).toBeVisible();
  });

  test("20) All order APIs fail, then manual refresh recovers in place", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    let round = 0;
    const mocks = installOwnerOrderMocks(page, {
      orders: () => {
        round += 1;
        return round === 1
          ? failureResponse("all fail")
          : successResponse(defaultOrders);
      },
      orderStatus: () => failureResponse("all fail"),
      orderCancel: () => failureResponse("all fail"),
    });

    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(0);
    await page.getByRole("button", { name: LABELS.refreshButton }).click();
    await expect(mocks.stats.orders).toBeGreaterThan(1);
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110001)),
    ).toBeVisible();
  });

  test("21) All order APIs fail, then reload recovers page state", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    let round = 0;
    const mocks = installOwnerOrderMocks(page, {
      orders: () => {
        round += 1;
        return round === 1
          ? failureResponse("all fail")
          : successResponse(defaultOrders);
      },
      orderStatus: () => failureResponse("all fail"),
      orderCancel: () => failureResponse("all fail"),
    });

    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(0);

    await page.reload();
    await waitForOrdersReady(page);
    await expect(mocks.stats.orders).toBeGreaterThan(1);
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110001)),
    ).toBeVisible();
  });

  test("22) 30-second refresh cadence can be simulated and updates orders", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    let round = 0;
    const mocks = installOwnerOrderMocks(page, {
      orders: () => {
        round += 1;
        const current = cloneOrders(defaultOrders).slice(0, 6);
        if (round > 1) {
          current[0] = {
            ...current[0],
            status: "ready",
          };
        }
        return successResponse(current);
      },
    });

    await openOwnerOrders(page, session);
    await page.evaluate(() => {
      const refreshButton = Array.from(
        document.querySelectorAll("button"),
      ).find((node) => node.textContent?.trim() === "Refresh") as
        | HTMLButtonElement
        | undefined;
      if (refreshButton) {
        window.setInterval(() => {
          refreshButton.click();
        }, 1500);
      }
    });
    await waitForOrdersReady(page);
    await expect(orderCards(page)).toHaveCount(6);
    await expect(
      page.getByPlaceholder(LABELS.searchPlaceholder).inputValue(),
    ).resolves.toBe("");

    await expect
      .poll(async () => mocks.stats.orders, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(3);
    await expect(orderCards(page)).toHaveCount(6);
    await expect(
      orderCardByNumber(page, formatOrderNumber(110001)),
    ).toBeVisible();
  });

  test("23) Navigate away to POS and back preserves order page availability", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);

    await page.goto(`${ADMIN_URL}/dashboard/pos/checkout`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/dashboard\/pos\/checkout/);
    await page.goBack();
    await waitForOrdersReady(page);
    await expect(page).toHaveURL(/\/dashboard\/orders/);
    await expect(
      orderCardByNumberText(page, formatOrderNumber(110001)),
    ).toBeVisible();
  });

  test("24) Navigate away to settings and come back by browser back", async ({
    page,
  }) => {
    const session = await getSmokeOwnerSession();
    installOwnerOrderMocks(page);
    await openOwnerOrders(page, session);
    await waitForOrdersReady(page);
    await page.goto(`${ADMIN_URL}/dashboard/settings`, {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await page.goBack();
    await waitForOrdersReady(page);
    await expect(
      page.getByRole("heading", { name: LABELS.heading }),
    ).toBeVisible();
  });
});
