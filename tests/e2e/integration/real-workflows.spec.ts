import { expect, test, type Page } from "@playwright/test";
import {
  firstAvailableMenuItemId,
  optionalEnv,
  resolveLocalSmokeFixtureIds,
  smokeLogin,
  type SmokeLoginData,
} from "../smoke/smoke-env";

const API_URL =
  optionalEnv("WORKFLOW_API_URL") ||
  optionalEnv("SMOKE_API_URL") ||
  "http://localhost:8787";
const CUSTOMER_URL =
  optionalEnv("WORKFLOW_CUSTOMER_URL") ||
  optionalEnv("SMOKE_CUSTOMER_URL") ||
  "http://localhost:3000";
const ADMIN_URL =
  optionalEnv("WORKFLOW_ADMIN_URL") || optionalEnv("SMOKE_ADMIN_URL");
const KITCHEN_URL =
  optionalEnv("WORKFLOW_KITCHEN_URL") || optionalEnv("SMOKE_KITCHEN_URL");
const MANAGEMENT_PORTAL_URL = optionalEnv("WORKFLOW_MANAGEMENT_PORTAL_URL");
const ONBOARDING_URL = optionalEnv("WORKFLOW_ONBOARDING_URL");
const MANAGEMENT_API_URL = optionalEnv("WORKFLOW_MANAGEMENT_API_URL");
const MANAGEMENT_WORKFLOW_API_URL =
  MANAGEMENT_API_URL ||
  optionalEnv("WORKFLOW_MANAGEMENT_PORTAL_API_URL") ||
  (MANAGEMENT_PORTAL_URL
    ? new URL("/api/v1", MANAGEMENT_PORTAL_URL).toString().replace(/\/$/, "")
    : undefined);

const AUTH_USERNAME =
  optionalEnv("WORKFLOW_AUTH_USERNAME") || optionalEnv("SMOKE_AUTH_USERNAME");
const AUTH_PASSWORD =
  optionalEnv("WORKFLOW_AUTH_PASSWORD") || optionalEnv("SMOKE_AUTH_PASSWORD");
const CHEF_USERNAME = optionalEnv("WORKFLOW_CHEF_USERNAME");
const CHEF_PASSWORD = optionalEnv("WORKFLOW_CHEF_PASSWORD");
const MANAGEMENT_TOKEN = optionalEnv("WORKFLOW_MANAGEMENT_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = optionalEnv("WORKFLOW_CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_API_TOKEN = optionalEnv("WORKFLOW_CLOUDFLARE_API_TOKEN");
const RESTAURANT_ID =
  optionalEnv("WORKFLOW_RESTAURANT_ID") || optionalEnv("SMOKE_RESTAURANT_ID");
const MENU_ITEM_ID = Number(
  optionalEnv("WORKFLOW_MENU_ITEM_ID") ||
    optionalEnv("SMOKE_MENU_ITEM_ID") ||
    NaN,
);

interface MenuItemCandidate {
  id?: number | string;
  name?: string;
  isAvailable?: boolean | number;
}

interface MenuBody {
  success: boolean;
  data?: {
    menuItems?: MenuItemCandidate[];
    items?: MenuItemCandidate[];
    categories?: Array<{
      id?: number | string;
      name?: string;
      items?: MenuItemCandidate[];
    }>;
  };
}

interface MenuMutationBody {
  success: boolean;
  data?: {
    id?: number;
    name?: string;
    price?: number;
    isAvailable?: boolean | number;
  };
}

interface GuestOrderResponse {
  success: boolean;
  data?: {
    order?: {
      id?: number;
      orderNumber?: string;
    };
    guestToken?: string;
  };
}

interface OrderBody {
  success: boolean;
  data?: {
    id?: number;
    status?: string;
    items?: Array<{
      id?: number;
      status?: string;
    }>;
  };
}

interface KitchenOrdersBody {
  success: boolean;
  data?: {
    pending?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
    preparing?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
    ready?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
  };
}

interface ManagementTenantSummary {
  id?: string;
  businessName?: string;
}

interface ManagementTenantsBody {
  data?: ManagementTenantSummary[];
  pagination?: unknown;
}

interface LoginResponse {
  success: boolean;
  data?: {
    token?: string;
    refreshToken?: string;
    user?: SmokeLoginData["user"] & {
      id?: number;
      username?: string;
      role?: number;
      permissions?: string[];
    };
  };
}

declare global {
  interface Window {
    __kitchenEventSourceUrls: string[];
  }
}

let loginDataPromise: Promise<SmokeLoginData> | undefined;
let chefLoginDataPromise: Promise<LoginResponse["data"]> | undefined;

function csrfHeaders() {
  const token = "a".repeat(64);
  const api = new URL(API_URL);
  return {
    "X-CSRF-Token": token,
    cookie: `csrf_token=${token}`,
    origin: api.origin,
    host: api.host,
  };
}

function getLoginData(): Promise<SmokeLoginData> | undefined {
  if (!AUTH_USERNAME || !AUTH_PASSWORD) return undefined;

  loginDataPromise ??= smokeLogin(API_URL, AUTH_USERNAME, AUTH_PASSWORD);
  loginDataPromise = loginDataPromise.catch((error) => {
    loginDataPromise = undefined;
    throw error;
  });

  return loginDataPromise;
}

async function resolveFixtureIds() {
  return resolveLocalSmokeFixtureIds({
    apiUrl: API_URL,
    authUsername: AUTH_USERNAME,
    authPassword: AUTH_PASSWORD,
    restaurantId: RESTAURANT_ID,
    menuItemId: Number.isFinite(MENU_ITEM_ID) ? MENU_ITEM_ID : undefined,
    loginData: await getLoginData(),
  });
}

async function fetchMenu(restaurantId: string): Promise<MenuBody> {
  const response = await fetch(`${API_URL}/api/v1/menu/${restaurantId}`);
  expect(response.ok, `menu API status ${response.status}`).toBe(true);
  return (await response.json()) as MenuBody;
}

async function loginChef() {
  if (!CHEF_USERNAME || !CHEF_PASSWORD) return undefined;

  chefLoginDataPromise ??= fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: CHEF_USERNAME,
      password: CHEF_PASSWORD,
      system: "kitchen",
    }),
  }).then(async (response) => {
    expect(response.ok, `chef login status ${response.status}`).toBe(true);
    const body = (await response.json()) as LoginResponse;
    expect(body.success, "chef login should succeed").toBe(true);
    expect(body.data?.user?.role, "chef role").toBe(2);
    return body.data;
  });

  chefLoginDataPromise = chefLoginDataPromise.catch((error) => {
    chefLoginDataPromise = undefined;
    throw error;
  });

  return chefLoginDataPromise;
}

function allMenuItems(menu: MenuBody): MenuItemCandidate[] {
  return [
    ...(menu.data?.menuItems ?? []),
    ...(menu.data?.items ?? []),
    ...(menu.data?.categories ?? []).flatMap(
      (category) => category.items ?? [],
    ),
  ];
}

function firstAvailableNamedMenuItem(menu: MenuBody) {
  return allMenuItems(menu).find(
    (item) =>
      item.name &&
      item.isAvailable !== false &&
      item.isAvailable !== 0 &&
      Number.isFinite(Number(item.id)),
  );
}

function firstMenuCategory(menu: MenuBody) {
  return menu.data?.categories?.find((category) =>
    Number.isFinite(Number(category.id)),
  );
}

function findMenuCategory(menu: MenuBody, categoryId: number) {
  return menu.data?.categories?.find(
    (category) => Number(category.id) === categoryId,
  );
}

function adminCategoryRow(page: Page, categoryId: number) {
  return page.locator(
    `[data-testid="category-row"][data-category-id="${categoryId}"]`,
  );
}

async function addMenuItemThroughUi(page: Page, id: number) {
  const quickAdd = page.getByTestId(`menu-item-add-${id}`).first();
  const customize = page.getByTestId(`menu-item-customize-${id}`).first();

  if ((await quickAdd.count()) > 0) {
    await quickAdd.click();
    return;
  }

  await customize.click();
  await expect(page.getByTestId("menu-item-modal")).toBeVisible();
  await page.getByTestId("menu-item-modal-add").click();
}

function adminOrderNumber(orderId: number) {
  return `ORD-${orderId.toString().padStart(6, "0")}`;
}

async function installAdminSession(page: Page, loginData: SmokeLoginData) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("auth_token", session.token ?? "");
    if (session.refreshToken) {
      window.localStorage.setItem("auth_refresh_token", session.refreshToken);
    }
    if (session.user) {
      window.localStorage.setItem("auth_user", JSON.stringify(session.user));
    }
    window.localStorage.setItem("makanmakan_locale", "en-US");
    window.localStorage.setItem("locale", "en-US");
  }, loginData);
}

async function installKitchenSession(
  page: Page,
  loginData: NonNullable<LoginResponse["data"]>,
) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("kitchen_auth_token", session.token ?? "");
    if (session.refreshToken) {
      window.localStorage.setItem(
        "kitchen_refresh_token",
        session.refreshToken,
      );
    }
    if (session.user) {
      window.localStorage.setItem("kitchen_user", JSON.stringify(session.user));
    }
    window.localStorage.setItem("makanmakan_locale", "en-US");
    window.localStorage.setItem("locale", "en-US");
    window.localStorage.setItem("kitchen-view-mode", "kanban");
  }, loginData);
}

async function installKitchenBrowserRuntimeHooks(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("kitchen_settings");
    window.localStorage.setItem("kitchen-view-mode", "kanban");
    window.__kitchenEventSourceUrls = [];

    class WorkflowEventSource extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;

      readonly url: string;
      readyState = WorkflowEventSource.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string) {
        super();
        this.url = url;
        window.__kitchenEventSourceUrls.push(url);

        window.setTimeout(() => {
          if (this.readyState === WorkflowEventSource.CLOSED) return;

          this.readyState = WorkflowEventSource.OPEN;
          const openEvent = new Event("open");
          this.onopen?.(openEvent);
          this.dispatchEvent(openEvent);

          this.dispatchEvent(
            new MessageEvent("connected", {
              data: JSON.stringify({ ok: true }),
            }),
          );
        }, 0);
      }

      close() {
        this.readyState = WorkflowEventSource.CLOSED;
      }
    }

    window.EventSource = WorkflowEventSource as unknown as typeof EventSource;
  });
}

async function installManagementSession(page: Page, token: string) {
  await page.addInitScript((managementToken) => {
    window.localStorage.setItem("management_token", managementToken);
  }, token);
}

async function fetchManagementTenant(
  token: string,
): Promise<ManagementTenantSummary | undefined> {
  if (!MANAGEMENT_WORKFLOW_API_URL) return undefined;

  const response = await fetch(`${MANAGEMENT_WORKFLOW_API_URL}/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `management tenants status ${response.status}`).toBe(
    true,
  );

  const body = (await response.json()) as ManagementTenantsBody;
  return body.data?.find((tenant) => tenant.id);
}

async function confirmOrder(orderId: number, token: string) {
  const response = await fetch(`${API_URL}/api/v1/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...csrfHeaders(),
    },
    body: JSON.stringify({ status: "confirmed" }),
  });

  expect(response.ok, `confirm order status ${response.status}`).toBe(true);
}

async function fetchOrder(orderId: number, token: string): Promise<OrderBody> {
  const response = await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `fetch order status ${response.status}`).toBe(true);
  return (await response.json()) as OrderBody;
}

async function fetchMenuItem(
  itemId: number,
  token: string,
): Promise<MenuMutationBody> {
  const response = await fetch(`${API_URL}/api/v1/menu/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `fetch menu item status ${response.status}`).toBe(true);
  return (await response.json()) as MenuMutationBody;
}

async function deleteMenuItemAsOwner(itemId: number, token: string) {
  await fetch(`${API_URL}/api/v1/menu/items/${itemId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      ...csrfHeaders(),
    },
  }).catch(() => {
    /* best-effort cleanup */
  });
}

async function deleteCategoryAsOwner(categoryId: number, token: string) {
  await fetch(`${API_URL}/api/v1/menu/categories/${categoryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      ...csrfHeaders(),
    },
  }).catch(() => {
    /* best-effort cleanup */
  });
}

async function cancelOrderAsOwner(orderId: number, token: string) {
  await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...csrfHeaders(),
    },
    body: JSON.stringify({ reason: "workflow cleanup" }),
  }).catch(() => {
    /* best-effort cleanup */
  });
}

async function fetchKitchenOrders(
  restaurantId: string,
  token: string,
): Promise<KitchenOrdersBody> {
  const response = await fetch(
    `${API_URL}/api/v1/kitchen/${restaurantId}/orders`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok, `fetch kitchen orders status ${response.status}`).toBe(
    true,
  );
  return (await response.json()) as KitchenOrdersBody;
}

function findKitchenOrder(body: KitchenOrdersBody, orderId: number) {
  return [
    ...(body.data?.pending ?? []),
    ...(body.data?.preparing ?? []),
    ...(body.data?.ready ?? []),
  ].find((order) => order.id === orderId);
}

test.describe.configure({ mode: "serial" });

test.describe("Real system workflows", () => {
  test("API and customer SPA are both reachable without mocks", async ({
    page,
  }) => {
    const infoResponse = await fetch(`${API_URL}/info`);
    expect(infoResponse.status, `${API_URL}/info status`).toBe(200);

    const response = await page.goto(CUSTOMER_URL, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.ok(), `${CUSTOMER_URL} should serve the app`).toBe(true);
    await expect(page.locator("#app[data-v-app]")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("customer menu page renders menu data served by the real API", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const item = firstAvailableNamedMenuItem(menu);
    test.skip(!item?.name, "real API did not return an available named item");

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/menu/${fixtureIds.restaurantId}`) &&
          response.ok(),
      ),
      page.goto(
        `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/table/1`,
        { waitUntil: "domcontentloaded" },
      ),
    ]);

    await expect(page.getByTestId("cart-btn")).toBeVisible();
    await expect(
      page.getByText(item!.name!, { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("customer can add a real menu item to cart and submit through checkout UI", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const item =
      allMenuItems(menu).find(
        (candidate) =>
          Number(candidate.id) === fixtureIds.menuItemId &&
          candidate.name &&
          candidate.isAvailable !== false &&
          candidate.isAvailable !== 0,
      ) ?? firstAvailableNamedMenuItem(menu);
    const menuItemId = Number(item?.id);

    test.skip(
      !item?.name || !Number.isFinite(menuItemId),
      "real API did not return an available named item",
    );

    await page.goto(
      `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/table/1`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.getByTestId(`menu-item-card-${menuItemId}`).first(),
    ).toBeVisible();
    await addMenuItemThroughUi(page, menuItemId);
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.getByTestId("cart-btn").click();
    await expect(page.getByTestId("cart-page")).toBeVisible();
    await expect(
      page.getByText(item!.name!, { exact: false }).first(),
    ).toBeVisible();

    const increaseButton = page.locator('[data-testid^="qty-increase-"]');
    await expect(increaseButton).toHaveCount(1);
    const quantityTestId = (await increaseButton.getAttribute("data-testid"))!;
    const cartItemId = quantityTestId.replace("qty-increase-", "");

    await increaseButton.click();
    await expect(
      page.getByTestId(`cart-item-quantity-${cartItemId}`),
    ).toHaveText("2");

    await page.getByTestId(`cart-item-notes-toggle-${cartItemId}`).click();
    await page
      .getByTestId(`cart-item-notes-${cartItemId}`)
      .fill("less spicy workflow note");
    await page.getByTestId("order-notes").fill("workflow table note");

    await page.locator("#customer-name").fill("Workflow UI");
    await page.locator("#customer-phone").fill("0912345678");

    let orderId: number | undefined;
    let guestToken: string | undefined;

    try {
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/guest-orders") &&
          response.request().method() === "POST",
      );

      await page.getByTestId("submit-order-btn").click();
      await expect(page.getByTestId("confirmation-modal")).toBeVisible();
      await page.getByTestId("confirmation-confirm").click();

      const createResponse = await createResponsePromise;
      expect(
        createResponse.ok(),
        `guest checkout status ${createResponse.status()}`,
      ).toBe(true);
      const createRequestBody = createResponse.request().postDataJSON() as {
        guestName?: string;
        phoneLastDigits?: string;
        notes?: string;
        items?: Array<{
          menuItemId?: number;
          quantity?: number;
          notes?: string;
        }>;
      };
      expect(createRequestBody.guestName).toBe("Workflow UI");
      expect(createRequestBody.phoneLastDigits).toBe("678");
      expect(createRequestBody.notes).toBe("workflow table note");
      expect(createRequestBody.items).toEqual([
        expect.objectContaining({
          menuItemId,
          quantity: 2,
          notes: "less spicy workflow note",
        }),
      ]);
      const createBody = (await createResponse.json()) as GuestOrderResponse;
      orderId = createBody.data?.order?.id;
      guestToken = createBody.data?.guestToken;

      expect(typeof orderId, "created order id").toBe("number");
      expect(typeof guestToken, "created guest token").toBe("string");

      await expect(page.getByTestId("order-timeline")).toBeVisible();
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      if (orderId && guestToken) {
        await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${guestToken}` },
        }).catch(() => {
          /* best-effort cleanup */
        });
      }
    }
  });

  test("guest order created by the real API is readable in customer tracking UI", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for guest workflow",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const menuItemId =
      fixtureIds.menuItemId ?? firstAvailableMenuItemId(menu as any);
    test.skip(menuItemId === undefined, "real API did not return a menu item");

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "shop",
        items: [{ menuItemId, quantity: 1 }],
        guestName: "workflow-test",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const orderNumber = createBody.data?.order?.orderNumber;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await page.addInitScript((token) => {
      window.localStorage.setItem("guest_auth_token", token);
    }, guestToken);

    try {
      await page.goto(
        `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/shop/order/${orderId}`,
        { waitUntil: "domcontentloaded" },
      );

      await expect(page.getByTestId("order-timeline")).toBeVisible();
      if (orderNumber) {
        await expect(
          page.getByText(orderNumber, { exact: true }),
        ).toBeVisible();
      }
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });

  test("owner dashboard updates a real API order status", async ({ page }) => {
    test.skip(!ADMIN_URL, "WORKFLOW_ADMIN_URL/SMOKE_ADMIN_URL is required");

    const loginData = await getLoginData();
    test.skip(
      !loginData?.token || !loginData.user,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for admin workflow",
    );

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "table",
        tableId: 1,
        items: [{ menuItemId: fixtureIds.menuItemId, quantity: 1 }],
        guestName: "workflow-admin",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await installAdminSession(page, loginData);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/v1/orders") && response.ok(),
        ),
        page.goto(`${ADMIN_URL}/dashboard/orders`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await expect(page.getByTestId("admin-orders-page")).toBeVisible();
      await expect(page.getByText(adminOrderNumber(orderId!))).toBeVisible();

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/orders/${orderId}/status`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId(`admin-order-update-${orderId}`).click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `admin order status update ${updateResponse.status()}`,
      ).toBe(true);

      await expect
        .poll(async () => {
          const body = await fetchOrder(orderId!, loginData.token!);
          return body.data?.status;
        })
        .toBe("confirmed");
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await cancelOrderAsOwner(orderId!, loginData.token!);
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });

  test("owner dashboard creates and updates a real menu item from the browser", async ({
    page,
  }) => {
    test.skip(!ADMIN_URL, "WORKFLOW_ADMIN_URL/SMOKE_ADMIN_URL is required");

    const loginData = await getLoginData();
    test.skip(
      !loginData?.token || !loginData.user,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const category = firstMenuCategory(menu);
    const categoryId = Number(category?.id);
    test.skip(
      !Number.isFinite(categoryId),
      "real API did not return a menu category",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const itemName = `Workflow Menu ${suffix}`;
    const updatedName = `Workflow Menu Updated ${suffix}`;
    let createdItemId: number | undefined;

    await installAdminSession(page, loginData);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/menu/${fixtureIds.restaurantId}`) &&
            response.ok(),
        ),
        page.goto(`${ADMIN_URL}/dashboard/menu`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await page.getByTestId("admin-menu-add-item").click();
      await expect(page.getByTestId("item-modal")).toBeVisible();
      await page.getByTestId("menu-item-name-input").fill(itemName);
      await page.getByTestId("menu-item-price-input").fill("12.34");
      await page
        .getByTestId("menu-item-category-select")
        .selectOption(String(categoryId));

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/menu/${fixtureIds.restaurantId}/items`) &&
          response.request().method() === "POST",
      );
      await page.getByTestId("menu-item-submit").click();
      const createResponse = await createResponsePromise;
      expect(
        createResponse.ok(),
        `admin menu item create ${createResponse.status()}`,
      ).toBe(true);
      const createBody = (await createResponse.json()) as MenuMutationBody;
      createdItemId = createBody.data?.id;
      expect(typeof createdItemId, "created menu item id").toBe("number");

      await page.getByTestId("admin-menu-search").fill(itemName);
      await expect(
        page.getByTestId(`admin-menu-item-${createdItemId}`),
      ).toBeVisible();

      await page.getByTestId(`admin-menu-item-${createdItemId}`).hover();
      await page.getByTestId(`admin-menu-item-edit-${createdItemId}`).click();
      await expect(page.getByTestId("item-modal")).toBeVisible();
      await page.getByTestId("menu-item-name-input").fill(updatedName);
      await page.getByTestId("menu-item-price-input").fill("13.45");

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/menu/items/${createdItemId}`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId("menu-item-submit").click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `admin menu item update ${updateResponse.status()}`,
      ).toBe(true);

      const updatedItem = await fetchMenuItem(createdItemId!, loginData.token!);
      expect(updatedItem.data?.name).toBe(updatedName);
      expect(updatedItem.data?.price).toBe(13.45);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      if (createdItemId) {
        await deleteMenuItemAsOwner(createdItemId, loginData.token!);
      }
    }
  });

  test("owner dashboard creates, updates, and deletes a real menu category from the browser", async ({
    page,
  }) => {
    test.skip(!ADMIN_URL, "WORKFLOW_ADMIN_URL/SMOKE_ADMIN_URL is required");

    const loginData = await getLoginData();
    test.skip(
      !loginData?.token || !loginData.user,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const categoryName = `Workflow Category ${suffix}`;
    const updatedCategoryName = `Workflow Category Updated ${suffix}`;
    let createdCategoryId: number | undefined;

    await installAdminSession(page, loginData);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/menu/${fixtureIds.restaurantId}`) &&
            response.ok(),
        ),
        page.goto(`${ADMIN_URL}/dashboard/menu`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await page.getByTestId("add-category-btn").click();
      await expect(page.getByTestId("admin-category-form")).toBeVisible();
      await page.getByTestId("admin-category-name-input").fill(categoryName);
      await page
        .getByTestId("admin-category-name-en-input")
        .fill(`Workflow Category EN ${suffix}`);
      await page
        .getByTestId("admin-category-description-input")
        .fill("Real workflow category created by Playwright");
      await page.getByTestId("admin-category-sort-order-input").fill("999");

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/menu/${fixtureIds.restaurantId}/categories`) &&
          response.request().method() === "POST",
      );
      await page.getByTestId("admin-category-submit").click();
      const createResponse = await createResponsePromise;
      expect(
        createResponse.ok(),
        `admin category create ${createResponse.status()}`,
      ).toBe(true);
      const createBody = (await createResponse.json()) as MenuMutationBody;
      createdCategoryId = createBody.data?.id;
      expect(typeof createdCategoryId, "created category id").toBe("number");

      await expect(adminCategoryRow(page, createdCategoryId!)).toBeVisible();

      await adminCategoryRow(page, createdCategoryId!).hover();
      await page
        .getByTestId(`admin-category-edit-${createdCategoryId}`)
        .click();
      await expect(page.getByTestId("admin-category-form")).toBeVisible();
      await page
        .getByTestId("admin-category-name-input")
        .fill(updatedCategoryName);
      await page
        .getByTestId("admin-category-description-input")
        .fill("Real workflow category updated by Playwright");

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/menu/categories/${createdCategoryId}`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId("admin-category-submit").click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `admin category update ${updateResponse.status()}`,
      ).toBe(true);

      await expect(adminCategoryRow(page, createdCategoryId!)).toContainText(
        updatedCategoryName,
      );
      await expect
        .poll(async () => {
          const menu = await fetchMenu(fixtureIds.restaurantId!);
          return findMenuCategory(menu, createdCategoryId!)?.name;
        })
        .toBe(updatedCategoryName);

      await adminCategoryRow(page, createdCategoryId!).hover();
      await page
        .getByTestId(`admin-category-delete-${createdCategoryId}`)
        .click();
      await expect(page.getByText(updatedCategoryName)).toBeVisible();

      const deleteResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/menu/categories/${createdCategoryId}`) &&
          response.request().method() === "DELETE",
      );
      await page.getByTestId("admin-delete-confirm").click();
      const deleteResponse = await deleteResponsePromise;
      expect(
        deleteResponse.ok(),
        `admin category delete ${deleteResponse.status()}`,
      ).toBe(true);

      await expect(adminCategoryRow(page, createdCategoryId!)).toHaveCount(0);
      await expect
        .poll(async () => {
          const menu = await fetchMenu(fixtureIds.restaurantId!);
          return findMenuCategory(menu, createdCategoryId!);
        })
        .toBeUndefined();
      createdCategoryId = undefined;
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      if (createdCategoryId) {
        await deleteCategoryAsOwner(createdCategoryId, loginData.token!);
      }
    }
  });

  test("kitchen display handles real orders plus SSE, offline, and audio browser runtime", async ({
    page,
  }) => {
    test.skip(
      !KITCHEN_URL,
      "WORKFLOW_KITCHEN_URL/SMOKE_KITCHEN_URL is required",
    );

    const ownerLoginData = await getLoginData();
    test.skip(
      !ownerLoginData?.token,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const chefLoginData = await loginChef();
    test.skip(
      !chefLoginData?.token || !chefLoginData.user,
      "WORKFLOW_CHEF_USERNAME and WORKFLOW_CHEF_PASSWORD are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for kitchen workflow",
    );

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "table",
        tableId: 1,
        items: [{ menuItemId: fixtureIds.menuItemId, quantity: 1 }],
        guestName: "workflow-kitchen",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await confirmOrder(orderId!, ownerLoginData!.token!);
    await installKitchenSession(page, chefLoginData);
    await installKitchenBrowserRuntimeHooks(page);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/kitchen/${fixtureIds.restaurantId}/orders`) &&
            response.ok(),
        ),
        page.goto(`${KITCHEN_URL}/kitchen/${fixtureIds.restaurantId}`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await expect(page.getByTestId("kitchen-dashboard")).toBeVisible();
      await expect(
        page.getByTestId("kitchen-connection-status"),
      ).toHaveAttribute("data-connection-status", "connected");
      await expect
        .poll(async () =>
          page.evaluate((restaurantId) => {
            return window.__kitchenEventSourceUrls.some((url) =>
              url.includes(`/api/v1/kitchen/${restaurantId}/events?token=`),
            );
          }, fixtureIds.restaurantId),
        )
        .toBe(true);

      await expect(page.getByTestId("kitchen-audio-toggle")).toHaveAttribute(
        "data-audio-enabled",
        "true",
      );
      await page.getByTestId("kitchen-audio-toggle").click();
      await expect(page.getByTestId("kitchen-audio-toggle")).toHaveAttribute(
        "data-audio-enabled",
        "false",
      );
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const settings = window.localStorage.getItem("kitchen_settings");
            return settings ? JSON.parse(settings).audioEnabled : undefined;
          }),
        )
        .toBe(false);

      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await expect(page.getByTestId("kitchen-offline-status")).toBeVisible();
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByTestId("kitchen-offline-status")).toHaveCount(0);

      await expect(
        page.getByTestId(`kitchen-order-card-${orderId}`),
      ).toBeVisible();

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/kitchen/${fixtureIds.restaurantId}/orders/`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId(`kitchen-order-start-${orderId}`).click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `kitchen item status update ${updateResponse.status()}`,
      ).toBe(true);

      await expect
        .poll(async () => {
          const body = await fetchKitchenOrders(
            fixtureIds.restaurantId!,
            chefLoginData.token!,
          );
          const order = findKitchenOrder(body, orderId!);
          return order?.items?.some((item) => item.status === "preparing");
        })
        .toBe(true);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await cancelOrderAsOwner(orderId!, ownerLoginData!.token!);
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });

  test("management portal health page loads data from the management API", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL || !MANAGEMENT_TOKEN,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    await installManagementSession(page, MANAGEMENT_TOKEN!);

    const healthResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/health") && response.ok(),
    );

    await page.goto(`${MANAGEMENT_PORTAL_URL}/health`, {
      waitUntil: "domcontentloaded",
    });

    await healthResponse;
    await expect(page.getByTestId("management-health-page")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("management portal tenants page loads tenant data from the management API", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL || !MANAGEMENT_TOKEN,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    await installManagementSession(page, MANAGEMENT_TOKEN!);

    const tenantsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/tenants") && response.ok(),
    );

    await page.goto(`${MANAGEMENT_PORTAL_URL}/tenants`, {
      waitUntil: "domcontentloaded",
    });

    await tenantsResponse;
    await expect(page.getByTestId("management-tenants-page")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("management portal tenant detail loads tenant resources, deployments, health, and licenses from the management API", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL ||
        !MANAGEMENT_TOKEN ||
        !MANAGEMENT_WORKFLOW_API_URL,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    const tenant = await fetchManagementTenant(MANAGEMENT_TOKEN!);
    test.skip(!tenant?.id, "management API did not return a tenant");

    await installManagementSession(page, MANAGEMENT_TOKEN!);

    const tenantResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/tenants/${tenant!.id}`) &&
        response.ok(),
    );
    const resourcesResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/tenants/${tenant!.id}/resources`) &&
        response.ok(),
    );
    const deploymentsResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/deployments/${tenant!.id}/history`) &&
        response.ok(),
    );
    const healthResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/health/tenants/${tenant!.id}`) &&
        response.ok(),
    );
    const licensesResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/licenses/${tenant!.id}`) &&
        response.ok(),
    );

    await page.goto(`${MANAGEMENT_PORTAL_URL}/tenants/${tenant!.id}`, {
      waitUntil: "domcontentloaded",
    });

    await Promise.all([
      tenantResponse,
      resourcesResponse,
      deploymentsResponse,
      healthResponse,
      licensesResponse,
    ]);
    await expect(
      page.getByTestId("management-tenant-detail-page"),
    ).toBeVisible();
    await expect(page.getByTestId("management-tenant-overview")).toBeVisible();
    if (tenant!.businessName) {
      await expect(page.getByText(tenant!.businessName).first()).toBeVisible();
    }

    await page.getByTestId("management-tenant-tab-deployments").click();
    await expect(
      page.getByTestId("management-tenant-deployments"),
    ).toBeVisible();
    await page.getByTestId("management-tenant-tab-health").click();
    await expect(page.getByTestId("management-tenant-health")).toBeVisible();
    await page.getByTestId("management-tenant-tab-license").click();
    await expect(page.getByTestId("management-tenant-license")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("management portal deployments, licenses, and markets pages load from management APIs", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL || !MANAGEMENT_TOKEN,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    await installManagementSession(page, MANAGEMENT_TOKEN!);

    const deploymentsTenantsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/tenants") && response.ok(),
    );
    await page.goto(`${MANAGEMENT_PORTAL_URL}/deployments`, {
      waitUntil: "domcontentloaded",
    });
    await deploymentsTenantsResponse;
    await expect(page.getByTestId("management-deployments-page")).toBeVisible();

    const licensesTenantsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/tenants") && response.ok(),
    );
    await page.goto(`${MANAGEMENT_PORTAL_URL}/licenses`, {
      waitUntil: "domcontentloaded",
    });
    await licensesTenantsResponse;
    await expect(page.getByTestId("management-licenses-page")).toBeVisible();

    const marketsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/markets") && response.ok(),
    );
    await page.goto(`${MANAGEMENT_PORTAL_URL}/markets`, {
      waitUntil: "domcontentloaded",
    });
    await marketsResponse;
    await expect(page.getByTestId("management-markets-page")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("onboarding app submits the application form to the management API", async ({
    page,
  }) => {
    test.skip(
      !ONBOARDING_URL || !MANAGEMENT_API_URL,
      "WORKFLOW_ONBOARDING_URL and WORKFLOW_MANAGEMENT_API_URL are required",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const subdomain = `workflow-${suffix}`;

    await page.goto(`${ONBOARDING_URL}/apply`, {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("onboarding-business-name").fill("Workflow Laksa");
    await page.getByTestId("onboarding-contact-name").fill("Tan Mei");
    await page
      .getByTestId("onboarding-contact-email")
      .fill(`workflow-${suffix}@example.com`);
    await page.getByTestId("onboarding-contact-phone").fill("0912345678");
    await page.getByTestId("onboarding-latitude").fill("24.147736");
    await page.getByTestId("onboarding-longitude").fill("120.673648");
    await page.getByTestId("onboarding-subdomain").fill(subdomain);

    await expect
      .poll(async () => {
        const response = await fetch(
          `${MANAGEMENT_API_URL}/api/v1/onboarding/subdomain/check?subdomain=${subdomain}`,
        );
        if (!response.ok) return false;
        const body = (await response.json()) as {
          success: boolean;
          data?: { available?: boolean };
        };
        return body.success && body.data?.available === true;
      })
      .toBe(true);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/onboarding/applications") &&
        response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-submit").click();

    const createResponse = await createResponsePromise;
    expect(
      createResponse.ok(),
      `onboarding create status ${createResponse.status()}`,
    ).toBe(true);
    const createBody = (await createResponse.json()) as {
      success: boolean;
      data?: { applicationId?: string; assignedSubdomain?: string };
    };
    expect(createBody.success).toBe(true);
    expect(createBody.data?.assignedSubdomain).toBe(subdomain);

    await expect(page).toHaveURL(/\/connect$/);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("onboarding app verifies Cloudflare credentials and completes from the browser", async ({
    page,
  }) => {
    test.skip(
      !ONBOARDING_URL ||
        !MANAGEMENT_API_URL ||
        !CLOUDFLARE_ACCOUNT_ID ||
        !CLOUDFLARE_API_TOKEN,
      "WORKFLOW_ONBOARDING_URL, WORKFLOW_MANAGEMENT_API_URL, WORKFLOW_CLOUDFLARE_ACCOUNT_ID, and WORKFLOW_CLOUDFLARE_API_TOKEN are required",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const subdomain = `workflow-cf-${suffix}`;

    await page.goto(`${ONBOARDING_URL}/apply`, {
      waitUntil: "domcontentloaded",
    });

    await page
      .getByTestId("onboarding-business-name")
      .fill("Workflow Cloudflare");
    await page.getByTestId("onboarding-contact-name").fill("Tan Mei");
    await page
      .getByTestId("onboarding-contact-email")
      .fill(`workflow-cf-${suffix}@example.com`);
    await page.getByTestId("onboarding-contact-phone").fill("0912345678");
    await page.getByTestId("onboarding-latitude").fill("24.147736");
    await page.getByTestId("onboarding-longitude").fill("120.673648");
    await page.getByTestId("onboarding-subdomain").fill(subdomain);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/onboarding/applications") &&
        response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-submit").click();

    const createResponse = await createResponsePromise;
    expect(
      createResponse.ok(),
      `onboarding create status ${createResponse.status()}`,
    ).toBe(true);
    const createBody = (await createResponse.json()) as {
      success: boolean;
      data?: { applicationId?: string; assignedSubdomain?: string };
    };
    const applicationId = createBody.data?.applicationId;
    expect(typeof applicationId, "created application id").toBe("string");
    expect(createBody.data?.assignedSubdomain).toBe(subdomain);

    await expect(page).toHaveURL(/\/connect$/);
    await page
      .getByTestId("onboarding-cf-account-id")
      .fill(CLOUDFLARE_ACCOUNT_ID!);
    await page
      .getByTestId("onboarding-cf-api-token")
      .fill(CLOUDFLARE_API_TOKEN!);

    const verifyResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/onboarding/applications/${applicationId}/verify-cloudflare`,
          ) && response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-cf-verify").click();
    const verifyResponse = await verifyResponsePromise;
    expect(
      verifyResponse.ok(),
      `onboarding verify status ${verifyResponse.status()}`,
    ).toBe(true);
    const verifyBody = (await verifyResponse.json()) as {
      success: boolean;
      data?: { verified?: boolean };
    };
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data?.verified).toBe(true);
    await expect(page.getByTestId("onboarding-cf-verified")).toBeVisible();

    const completeResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/onboarding/applications/${applicationId}/complete`,
          ) && response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-complete").click();
    const completeResponse = await completeResponsePromise;
    expect(
      completeResponse.ok(),
      `onboarding complete status ${completeResponse.status()}`,
    ).toBe(true);
    const completeBody = (await completeResponse.json()) as {
      success: boolean;
      data?: { tenantId?: string; subdomain?: string; status?: string };
    };
    expect(completeBody.success).toBe(true);
    expect(typeof completeBody.data?.tenantId).toBe("string");
    expect(completeBody.data?.subdomain).toBe(subdomain);
    expect(completeBody.data?.status).toBe("completed");

    await expect(page).toHaveURL(/\/success$/);
    await expect(page.getByTestId("onboarding-success")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });
});
