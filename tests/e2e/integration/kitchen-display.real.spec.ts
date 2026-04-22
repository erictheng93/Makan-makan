/**
 * Kitchen Display E2E Integration Test (Real Backend)
 *
 * Opens the real kitchen display in a real browser and verifies that a chef
 * can see and progress a real confirmed order backed by localhost:8787.
 *
 * No API mocking.
 *
 * Prerequisites:
 *   - pnpm dev:api       (localhost:8787)
 *   - pnpm dev:kitchen   (localhost:3002)
 *   - pnpm db:seed:mock
 */

import { test, expect, devices } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  USERS,
  loginAs,
  createGuestOrder,
  updateOrderStatus,
  cleanupOrder,
} from "./helpers";

const API_URL = "http://localhost:8787";
const KITCHEN_APP = process.env.E2E_KITCHEN_URL || "http://localhost:3002";

test.use({ ...devices["iPad Pro 11"] });

type KitchenOrder = {
  id: number;
  orderNumber?: string;
  status: string;
  items: Array<{ id: number; status: string }>;
};

type KitchenOrdersResponse = {
  pending: KitchenOrder[];
  preparing: KitchenOrder[];
  ready: KitchenOrder[];
};

function findKitchenOrder(
  data: KitchenOrdersResponse,
  orderId: number,
): KitchenOrder | undefined {
  return [...data.pending, ...data.preparing, ...data.ready].find(
    (order) => order.id === orderId,
  );
}

async function getKitchenOrder(orderId: number): Promise<KitchenOrder> {
  const chefAuth = await loginAs(USERS.CHEF);
  const res = await fetch(`${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`, {
    headers: {
      Authorization: `Bearer ${chefAuth.token}`,
      Origin: API_URL,
    },
  });
  if (!res.ok) {
    throw new Error(`Kitchen orders fetch failed: ${res.status}`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(`Kitchen orders payload invalid: ${JSON.stringify(json)}`);
  }

  const order = findKitchenOrder(json.data as KitchenOrdersResponse, orderId);
  if (!order) {
    throw new Error(`Kitchen order ${orderId} not found`);
  }

  return order;
}

async function seedKitchenPrefs(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("locale", "zh-TW");
    localStorage.setItem("kitchen-view-mode", "grid");
  });
}

async function loginToKitchen(page: import("@playwright/test").Page) {
  await seedKitchenPrefs(page);
  await page.goto(`${KITCHEN_APP}/login`);
  await page.locator("#username").fill(USERS.CHEF);
  await page.locator("#password").fill("password123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/kitchen/${RESTAURANT_ID}$`), {
    timeout: 15000,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Kitchen display (real backend)", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("chef can see a confirmed real order on the kitchen dashboard", async ({
    page,
  }) => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.GONG_WAN_TANG, quantity: 1 }],
      {
        guestName: "Kitchen UI Guest",
      },
    );
    createdOrderId = created.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(createdOrderId, "confirmed", ownerAuth);

    const kitchenOrder = await getKitchenOrder(createdOrderId);
    const expectedOrderNumber =
      kitchenOrder.orderNumber ??
      created.data.order.orderNumber ??
      `ORD-${createdOrderId}`;

    await loginToKitchen(page);
    await expect(
      page
        .locator("main")
        .getByText(/訂單|Orders|廚房/i)
        .first(),
    ).toBeVisible({ timeout: 15000 });

    const orderNumber = page.getByText(expectedOrderNumber, { exact: true });
    await expect(orderNumber).toBeVisible({ timeout: 15000 });

    const orderCard = orderNumber.locator(
      "xpath=ancestor::div[contains(@class,'rounded-2xl')][1]",
    );
    await expect(orderCard).toContainText(/貢丸湯|Gong Wan Tang/i);
    await expect(orderCard).toContainText(/桌|Table|內用|Dine/i);
  });

  test("chef can start preparing a real order from the kitchen dashboard", async ({
    page,
  }) => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      {
        guestName: "Kitchen Status Guest",
      },
    );
    createdOrderId = created.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(createdOrderId, "confirmed", ownerAuth);

    const kitchenOrder = await getKitchenOrder(createdOrderId);
    const expectedOrderNumber =
      kitchenOrder.orderNumber ??
      created.data.order.orderNumber ??
      `ORD-${createdOrderId}`;

    await loginToKitchen(page);

    const orderNumber = page.getByText(expectedOrderNumber, { exact: true });
    await expect(orderNumber).toBeVisible({ timeout: 15000 });

    const orderCard = orderNumber.locator(
      "xpath=ancestor::div[contains(@class,'rounded-2xl')][1]",
    );
    await expect(orderCard).toContainText(/紅茶|Black Tea/i);

    const startButton = orderCard.getByRole("button", {
      name: /開始製作|Start Preparing/i,
    });
    await expect(startButton).toBeVisible();
    await startButton.scrollIntoViewIfNeeded();
    await startButton.evaluate((button: HTMLButtonElement) => button.click());

    await expect
      .poll(async () => {
        const latestOrder = await getKitchenOrder(createdOrderId!);
        return latestOrder.items[0]?.status;
      })
      .toBe("preparing");

    await expect(orderCard).toContainText(/紅茶|Black Tea/i);
    await expect(
      orderCard.getByRole("button", { name: /開始製作|Start Preparing/i }),
    ).toHaveCount(0);
  });
});
