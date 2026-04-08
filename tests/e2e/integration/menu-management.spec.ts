/**
 * Menu Management Integration Tests
 *
 * Tests menu category and item CRUD against the real API at localhost:8787 with real D1.
 * Each test is fully independent: it creates its own data and cleans up after itself.
 */

import { test, expect } from "@playwright/test";
import { RESTAURANT_ID, USERS, loginAs } from "./helpers";

const API_URL = "http://localhost:8787";

// ─── Auth header helper ───

interface AuthCredentials {
  token: string;
  csrfToken: string;
  csrfCookie: string;
}

function authHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
    Origin: API_URL,
    "X-CSRF-Token": auth.csrfToken,
    Cookie: auth.csrfCookie,
  };
}

// ─── Low-level helpers ───

async function createCategory(
  name: string,
  auth: AuthCredentials,
): Promise<{ id: number; name: string; restaurantId: string }> {
  const res = await fetch(
    `${API_URL}/api/v1/menu/${RESTAURANT_ID}/categories`,
    {
      method: "POST",
      headers: authHeaders(auth),
      body: JSON.stringify({ name, sortOrder: 0 }),
    },
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `createCategory failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data.data;
}

async function deleteCategory(
  id: number,
  auth: AuthCredentials,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/menu/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(auth),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `deleteCategory(${id}) cleanup warning: ${res.status} ${text}`,
    );
  }
}

async function createMenuItem(
  categoryId: number,
  name: string,
  price: number,
  auth: AuthCredentials,
): Promise<{ id: number; name: string; price: number; isAvailable: boolean }> {
  const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}/items`, {
    method: "POST",
    headers: authHeaders(auth),
    body: JSON.stringify({
      categoryId,
      name,
      price,
      description: "整合測試自動建立的品項",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `createMenuItem failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data.data;
}

async function deleteMenuItem(
  id: number,
  auth: AuthCredentials,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/menu/items/${id}`, {
    method: "DELETE",
    headers: authHeaders(auth),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `deleteMenuItem(${id}) cleanup warning: ${res.status} ${text}`,
    );
  }
}

// ─── Category CRUD ───────────────────────────────────────────────────────────

test.describe("Menu Categories CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let ownerAuth: AuthCredentials;
  let createdCategoryId: number | undefined;

  test.beforeAll(async () => {
    ownerAuth = await loginAs(USERS.OWNER);
  });

  test.afterEach(async () => {
    if (createdCategoryId !== undefined) {
      await deleteCategory(createdCategoryId, ownerAuth);
      createdCategoryId = undefined;
    }
  });

  test("owner can create a new menu category", async () => {
    const res = await fetch(
      `${API_URL}/api/v1/menu/${RESTAURANT_ID}/categories`,
      {
        method: "POST",
        headers: authHeaders(ownerAuth),
        body: JSON.stringify({ name: "測試分類", sortOrder: 99 }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      name: "測試分類",
      restaurantId: RESTAURANT_ID,
    });

    createdCategoryId = data.data.id;
  });

  test("owner can list categories for their restaurant", async () => {
    // Create a category first so we know at least one exists
    const category = await createCategory("列表測試分類", ownerAuth);
    createdCategoryId = category.id;

    // The public menu endpoint returns categories within the menu response.
    const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}`);
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);
    // The menu response contains categories
    const categories: Array<{ id: number; name: string }> =
      data.data?.categories ?? [];
    const found = categories.some((c) => c.id === category.id);
    expect(found).toBe(true);
  });

  test("owner can update a category name", async () => {
    const category = await createCategory("原始分類名稱", ownerAuth);
    createdCategoryId = category.id;

    const res = await fetch(
      `${API_URL}/api/v1/menu/categories/${category.id}`,
      {
        method: "PUT",
        headers: authHeaders(ownerAuth),
        body: JSON.stringify({ name: "更新後的分類名稱" }),
      },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({ name: "更新後的分類名稱" });
  });

  test("owner can delete a category (only if no items)", async () => {
    const category = await createCategory("待刪除分類", ownerAuth);
    // Don't assign to createdCategoryId — we expect to delete it in the test
    const catId = category.id;

    const res = await fetch(`${API_URL}/api/v1/menu/categories/${catId}`, {
      method: "DELETE",
      headers: authHeaders(ownerAuth),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // createdCategoryId stays undefined — already deleted, afterEach is a no-op
  });

  test("non-owner (chef) cannot create categories (403)", async () => {
    const chefAuth = await loginAs(USERS.CHEF);

    const res = await fetch(
      `${API_URL}/api/v1/menu/${RESTAURANT_ID}/categories`,
      {
        method: "POST",
        headers: authHeaders(chefAuth),
        body: JSON.stringify({ name: "廚師不應建立的分類", sortOrder: 0 }),
      },
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});

// ─── Menu Items CRUD ─────────────────────────────────────────────────────────

test.describe("Menu Items CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let ownerAuth: AuthCredentials;
  let scaffoldCategoryId: number; // Shared category for item tests
  let createdItemId: number | undefined;

  test.beforeAll(async () => {
    ownerAuth = await loginAs(USERS.OWNER);
    // Create a throwaway category to hold items created during tests
    const category = await createCategory("整合測試暫用分類", ownerAuth);
    scaffoldCategoryId = category.id;
  });

  test.afterEach(async () => {
    if (createdItemId !== undefined) {
      await deleteMenuItem(createdItemId, ownerAuth);
      createdItemId = undefined;
    }
  });

  test.afterAll(async () => {
    // Clean up the scaffold category (all items should already be deleted by afterEach)
    await deleteCategory(scaffoldCategoryId, ownerAuth);
  });

  test("owner can create a menu item with price", async () => {
    const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}/items`, {
      method: "POST",
      headers: authHeaders(ownerAuth),
      body: JSON.stringify({
        categoryId: scaffoldCategoryId,
        name: "測試品項",
        price: 15000, // NT$150 in cents
        description: "整合測試品項",
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      name: "測試品項",
      price: 15000,
      restaurantId: RESTAURANT_ID,
    });

    createdItemId = data.data.id;
  });

  test("created item appears in guest-accessible menu listing", async () => {
    const item = await createMenuItem(
      scaffoldCategoryId,
      "上架品項",
      8000,
      ownerAuth,
    );
    createdItemId = item.id;

    // Guest fetch — write-through cache invalidation should make the new
    // item visible immediately on the next public read.
    const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}`);
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);

    // Menu response has two top-level lists: `categories` and `menuItems`.
    // Items are not nested inside categories.
    const items: Array<{ id: number; name: string }> =
      data.data?.menuItems ?? [];
    const found = items.some((i) => i.id === item.id);
    expect(found).toBe(true);
  });

  test("owner can update menu item price", async () => {
    const item = await createMenuItem(
      scaffoldCategoryId,
      "價格更新品項",
      12000,
      ownerAuth,
    );
    createdItemId = item.id;

    const res = await fetch(`${API_URL}/api/v1/menu/items/${item.id}`, {
      method: "PUT",
      headers: authHeaders(ownerAuth),
      body: JSON.stringify({ price: 13500 }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({ price: 13500 });
  });

  test("owner can toggle item availability (available → unavailable)", async () => {
    const item = await createMenuItem(
      scaffoldCategoryId,
      "下架測試品項",
      9000,
      ownerAuth,
    );
    createdItemId = item.id;

    // New items are available by default — set to unavailable
    const res = await fetch(`${API_URL}/api/v1/menu/items/${item.id}`, {
      method: "PUT",
      headers: authHeaders(ownerAuth),
      body: JSON.stringify({ isAvailable: false }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.isAvailable).toBe(false);
  });

  test("owner can delete a menu item", async () => {
    const item = await createMenuItem(
      scaffoldCategoryId,
      "待刪除品項",
      5000,
      ownerAuth,
    );
    // Don't assign to createdItemId — we delete in the test itself
    const itemId = item.id;

    const res = await fetch(`${API_URL}/api/v1/menu/items/${itemId}`, {
      method: "DELETE",
      headers: authHeaders(ownerAuth),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // createdItemId stays undefined — already deleted
  });

  test("unavailable items do not appear in guest menu response", async () => {
    // Create item, then mark unavailable
    const item = await createMenuItem(
      scaffoldCategoryId,
      "隱藏品項",
      7500,
      ownerAuth,
    );
    createdItemId = item.id;

    await fetch(`${API_URL}/api/v1/menu/items/${item.id}`, {
      method: "PUT",
      headers: authHeaders(ownerAuth),
      body: JSON.stringify({ isAvailable: false }),
    });

    // Guest fetch should NOT see the unavailable item
    const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}`);
    const data = await res.json();

    expect(res.ok).toBe(true);
    const items: Array<{ id: number; isAvailable: boolean }> =
      data.data?.menuItems ?? [];
    const found = items.some((i) => i.id === item.id);
    expect(found).toBe(false);
  });
});

// ─── KV Cache invalidation smoke test ───────────────────────────────────────

test.describe("KV Cache invalidation", () => {
  let ownerAuth: AuthCredentials;
  let scaffoldCategoryId: number;
  let createdItemId: number | undefined;

  test.beforeAll(async () => {
    ownerAuth = await loginAs(USERS.OWNER);
    const category = await createCategory("快取測試暫用分類", ownerAuth);
    scaffoldCategoryId = category.id;
  });

  test.afterEach(async () => {
    if (createdItemId !== undefined) {
      await deleteMenuItem(createdItemId, ownerAuth);
      createdItemId = undefined;
    }
  });

  test.afterAll(async () => {
    await deleteCategory(scaffoldCategoryId, ownerAuth);
  });

  test("menu update should be reflected immediately on next GET /menu", async () => {
    // 1. Create an item
    const item = await createMenuItem(
      scaffoldCategoryId,
      "快取測試品項",
      11000,
      ownerAuth,
    );
    createdItemId = item.id;

    // 2. Confirm item appears in the public menu — items live in
    // data.menuItems, not nested inside categories.
    const before = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}`);
    const beforeData = await before.json();
    const beforeItems: Array<{ id: number; name: string }> =
      beforeData.data?.menuItems ?? [];
    expect(beforeItems.some((i) => i.id === item.id)).toBe(true);

    // 3. Update the item's name
    const updatedName = "快取測試品項（已更新）";
    const updateRes = await fetch(`${API_URL}/api/v1/menu/items/${item.id}`, {
      method: "PUT",
      headers: authHeaders(ownerAuth),
      body: JSON.stringify({ name: updatedName }),
    });
    expect(updateRes.status).toBe(200);

    // 4. Immediately re-fetch — both KV and Cache API tiers should have been
    // invalidated by the PUT, so the new name is visible right away.
    const after = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}`);
    const afterData = await after.json();
    const afterItems: Array<{ id: number; name: string }> =
      afterData.data?.menuItems ?? [];
    const updatedItem = afterItems.find((i) => i.id === item.id);

    expect(updatedItem).toBeDefined();
    expect(updatedItem?.name).toBe(updatedName);
  });
});
