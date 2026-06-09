import { expect, test, type Page } from "@playwright/test";

const RESTAURANT_ID = "restaurant-kitchen-e2e";
const KITCHEN_BASE_URL =
  process.env.E2E_KITCHEN_URL ?? process.env.E2E_BASE_URL;

if (KITCHEN_BASE_URL) {
  test.use({ baseURL: KITCHEN_BASE_URL });
}

test.describe.configure({ timeout: 60_000 });

function unsignedJwt(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

const CHEF_TOKEN = unsignedJwt({
  sub: "22",
  role: 2,
  restaurantId: RESTAURANT_ID,
  exp: Math.floor(Date.now() / 1000) + 60 * 60,
});

const OWNER_TOKEN = unsignedJwt({
  sub: "12",
  role: 1,
  restaurantId: RESTAURANT_ID,
  exp: Math.floor(Date.now() / 1000) + 60 * 60,
});

type ItemStatus = "pending" | "preparing" | "ready";
type OrderStatus = "confirmed" | "preparing" | "ready";

interface KitchenOrderItem {
  id: number;
  name: string;
  quantity: number;
  status: ItemStatus;
  priority: "normal" | "high" | "urgent";
  estimatedTime?: number;
}

interface KitchenOrder {
  id: number;
  orderNumber: string;
  tableName: string;
  status: OrderStatus;
  deliveryInfo: { type: "dine_in" };
  items: KitchenOrderItem[];
  createdAt: string;
  totalItems: number;
  priority: "normal" | "high" | "urgent";
  elapsedTime: number;
}

const makeOrder = (): KitchenOrder => ({
  id: 7001,
  orderNumber: "KDS-7001",
  tableName: "Table 9",
  status: "confirmed",
  deliveryInfo: { type: "dine_in" },
  items: [
    {
      id: 8101,
      name: "Nasi Lemak",
      quantity: 2,
      status: "pending",
      priority: "normal",
      estimatedTime: 8,
    },
  ],
  createdAt: "2026-06-09T01:00:00.000Z",
  totalItems: 2,
  priority: "normal",
  elapsedTime: 3,
});

function groupedOrders(order: KitchenOrder) {
  return {
    pending: order.status === "confirmed" ? [order] : [],
    preparing: order.status === "preparing" ? [order] : [],
    ready: order.status === "ready" ? [order] : [],
    stats: {
      pendingCount: order.status === "confirmed" ? 1 : 0,
      preparingCount: order.status === "preparing" ? 1 : 0,
      readyCount: order.status === "ready" ? 1 : 0,
      completedToday: order.status === "ready" ? 1 : 0,
      averageCookingTime: 0,
      averageWaitingTime: 3,
      efficiency: 100,
      urgentOrders: order.priority === "urgent" ? 1 : 0,
    },
  };
}

async function installKitchenSession(page: Page) {
  await page.addInitScript(
    ({ restaurantId, token }) => {
      localStorage.setItem("kitchen_auth_token", token);
      localStorage.setItem("kitchen_refresh_token", "kitchen-e2e-refresh");
      localStorage.setItem(
        "kitchen_user",
        JSON.stringify({
          id: 22,
          username: "chef-e2e",
          name: "Chef E2E",
          role: 2,
          restaurantId,
          permissions: ["kitchen:read", "kitchen:update"],
        }),
      );
      localStorage.setItem("makanmakan_locale", "en-US");
      localStorage.setItem("locale", "en-US");

      class MockWebSocket extends EventTarget {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readyState = MockWebSocket.CONNECTING;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;

        constructor(public url: string) {
          super();
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            const event = new Event("open");
            this.dispatchEvent(event);
            this.onopen?.(event);
          }, 0);
        }

        send() {}

        close(code = 1000, reason = "test close") {
          this.readyState = MockWebSocket.CLOSED;
          const event = new CloseEvent("close", { code, reason });
          this.dispatchEvent(event);
          this.onclose?.(event);
        }
      }

      Object.assign(MockWebSocket, {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
      });
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    },
    { restaurantId: RESTAURANT_ID, token: CHEF_TOKEN },
  );
}

async function mockKitchenApi(page: Page) {
  let order = makeOrder();
  const updates: ItemStatus[] = [];

  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: 22,
          username: "chef-e2e",
          name: "Chef E2E",
          role: 2,
          restaurantId: RESTAURANT_ID,
          permissions: ["kitchen:read", "kitchen:update"],
        },
      }),
    });
  });

  await page.route("**/api/v1/realtime/auth/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          token: "ws-token",
          wsUrl: "ws://localhost:9876/kitchen-e2e",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      }),
    });
  });

  await page.route(
    `**/api/v1/kitchen/${RESTAURANT_ID}/orders`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: groupedOrders(order),
          timestamp: new Date().toISOString(),
        }),
      });
    },
  );

  await page.route(
    `**/api/v1/kitchen/${RESTAURANT_ID}/orders/7001/items/8101`,
    async (route) => {
      const request = route.request();
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }

      const body = request.postDataJSON() as { status: ItemStatus };
      updates.push(body.status);
      order = {
        ...order,
        status: body.status === "preparing" ? "preparing" : "ready",
        items: order.items.map((item) =>
          item.id === 8101 ? { ...item, status: body.status } : item,
        ),
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { orderId: 7001, itemId: 8101, status: body.status },
          timestamp: new Date().toISOString(),
        }),
      });
    },
  );

  return { updates };
}

test("chef can complete the core kitchen display order flow", async ({
  page,
}) => {
  const api = await mockKitchenApi(page);
  await installKitchenSession(page);

  await page.goto(`/kitchen/${RESTAURANT_ID}`);

  await expect(
    page.getByRole("heading", { name: "Kitchen Board" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("kitchen-order-card-7001")).toContainText(
    "KDS-7001",
  );
  await expect(page.getByText("Nasi Lemak")).toBeVisible();

  await page.getByTestId("kitchen-item-start-7001-8101").click();
  await expect(page.getByTestId("kitchen-order-card-7001")).toContainText(
    "Nasi Lemak",
  );
  await expect(page.getByTestId("kitchen-item-ready-7001-8101")).toBeVisible();

  await page.getByTestId("kitchen-item-ready-7001-8101").click();
  await expect.poll(() => api.updates).toEqual(["preparing", "ready"]);
  await expect(page.getByTestId("kitchen-order-card-7001")).toContainText(
    "Completed",
  );
});

test("non-chef sessions are denied access to protected kitchen routes", async ({
  page,
}) => {
  await page.addInitScript(
    ({ restaurantId, token }) => {
      localStorage.setItem("kitchen_auth_token", token);
      localStorage.setItem(
        "kitchen_user",
        JSON.stringify({
          id: 12,
          username: "owner-e2e",
          name: "Owner E2E",
          role: 1,
          restaurantId,
          permissions: [],
        }),
      );
    },
    { restaurantId: RESTAURANT_ID, token: OWNER_TOKEN },
  );

  await page.goto(`/kitchen/${RESTAURANT_ID}`);
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByTestId("kitchen-order-card-7001")).toHaveCount(0);
});
