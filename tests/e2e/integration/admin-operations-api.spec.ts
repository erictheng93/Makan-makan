/**
 * Admin Operations API Integration Tests
 *
 * Tests tables and user management endpoints against the real API at localhost:8787.
 * No mocking — hits real D1 database.
 *
 * Covers:
 *   - Tables: list, create, update, delete (owner + access-control)
 *   - Users: list, create, deactivate (admin + owner)
 */

import { test, expect } from "@playwright/test";
import { loginAs, RESTAURANT_ID, USERS } from "./helpers";

const API_URL = "http://localhost:8787";

// ─── Auth header helpers ──────────────────────────────────────────────────────

interface AuthCredentials {
  token: string;
  csrfToken: string;
  csrfCookie: string;
}

function mutateHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
    Origin: API_URL,
    "X-CSRF-Token": auth.csrfToken,
    Cookie: auth.csrfCookie,
  };
}

function readHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.token}`,
    Origin: API_URL,
  };
}

// ─── Tables ──────────────────────────────────────────────────────────────────

test.describe("Tables API", () => {
  test.describe.configure({ mode: "serial" });

  let ownerAuth: AuthCredentials;
  let createdTableId: number | undefined;

  test.beforeAll(async () => {
    ownerAuth = await loginAs(USERS.OWNER);
  });

  test.afterAll(async () => {
    // Clean up the table if it wasn't deleted during the test run
    if (createdTableId !== undefined) {
      try {
        const auth = await loginAs(USERS.OWNER);
        await fetch(`${API_URL}/api/v1/tables/${createdTableId}`, {
          method: "DELETE",
          headers: mutateHeaders(auth),
        });
      } catch {
        /* swallow cleanup errors */
      }
    }
  });

  test("owner can list their restaurant's tables", async () => {
    const res = await fetch(
      `${API_URL}/api/v1/tables?restaurantId=${RESTAURANT_ID}`,
      { headers: readHeaders(ownerAuth) },
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("chef can also read the table list (all staff allowed)", async () => {
    // GET /tables allows admin, owner, chef, service, cashier — only customers
    // are blocked. The seed data has no customer user, so we positively assert
    // staff access here.
    const chefAuth = await loginAs(USERS.CHEF);

    const res = await fetch(
      `${API_URL}/api/v1/tables?restaurantId=${RESTAURANT_ID}`,
      { headers: readHeaders(chefAuth) },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("owner creates a new table", async () => {
    const tableNumber = `E2E_${Date.now()}`;

    const res = await fetch(`${API_URL}/api/v1/tables`, {
      method: "POST",
      headers: mutateHeaders(ownerAuth),
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        number: tableNumber,
        capacity: 4,
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject(
      expect.objectContaining({
        number: tableNumber,
        capacity: 4,
      }),
    );
    expect(data.data.id).toBeDefined();

    createdTableId = data.data.id;
  });

  test("owner updates the created table capacity", async () => {
    expect(createdTableId).toBeDefined();

    const res = await fetch(`${API_URL}/api/v1/tables/${createdTableId}`, {
      method: "PUT",
      headers: mutateHeaders(ownerAuth),
      body: JSON.stringify({ capacity: 6 }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject(expect.objectContaining({ capacity: 6 }));
  });

  test("owner deletes the created table", async () => {
    expect(createdTableId).toBeDefined();

    const res = await fetch(`${API_URL}/api/v1/tables/${createdTableId}`, {
      method: "DELETE",
      headers: mutateHeaders(ownerAuth),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Mark as cleaned up so afterAll skips it
    createdTableId = undefined;
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

test.describe("Users API", () => {
  test.describe.configure({ mode: "serial" });

  let adminAuth: AuthCredentials;
  let ownerAuth: AuthCredentials;
  let createdUserId: number | undefined;

  test.beforeAll(async () => {
    [adminAuth, ownerAuth] = await Promise.all([
      loginAs(USERS.ADMIN),
      loginAs(USERS.OWNER),
    ]);
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete the test user if it still exists
    if (createdUserId !== undefined) {
      try {
        const auth = await loginAs(USERS.ADMIN);
        await fetch(`${API_URL}/api/v1/users/${createdUserId}`, {
          method: "DELETE",
          headers: mutateHeaders(auth),
        });
      } catch {
        /* swallow cleanup errors */
      }
    }
  });

  test("owner can list users for their restaurant", async () => {
    const res = await fetch(`${API_URL}/api/v1/users`, {
      headers: readHeaders(ownerAuth),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("admin can create a new staff user", async () => {
    const username = `e2e_test_${Date.now()}`;

    const res = await fetch(`${API_URL}/api/v1/users`, {
      method: "POST",
      headers: mutateHeaders(adminAuth),
      body: JSON.stringify({
        username,
        fullName: "E2E Test User",
        password: "Test@12345",
        role: 3,
        restaurantId: 1,
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.username).toBe(username);
    expect(data.data.fullName).toBe("E2E Test User");
    expect(data.data.role).toBe(3);

    createdUserId = data.data.id;
  });

  test("admin can deactivate the created user", async () => {
    if (createdUserId === undefined) {
      console.warn("Skipping deactivation test — no user was created.");
      return;
    }

    const res = await fetch(`${API_URL}/api/v1/users/${createdUserId}/status`, {
      method: "PATCH",
      headers: mutateHeaders(adminAuth),
      body: JSON.stringify({ isActive: false }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // The endpoint returns {success, message} only — no data payload, so we
    // verify the status by re-reading the user.
    const reRead = await fetch(`${API_URL}/api/v1/users/${createdUserId}`, {
      headers: readHeaders(adminAuth),
    });
    const reReadData = await reRead.json();
    expect(reReadData.success).toBe(true);
    expect(reReadData.data.isActive).toBe(false);
  });

  test("cleanup: delete the created test user", async () => {
    if (createdUserId === undefined) {
      console.warn("Skipping user deletion — no user was created.");
      return;
    }

    const res = await fetch(`${API_URL}/api/v1/users/${createdUserId}`, {
      method: "DELETE",
      headers: mutateHeaders(adminAuth),
    });

    // Accept 200 (deleted) or 404 (already gone) as success
    expect([200, 404]).toContain(res.status);

    // Mark as cleaned up so afterAll skips redundant attempt
    createdUserId = undefined;
  });
});
