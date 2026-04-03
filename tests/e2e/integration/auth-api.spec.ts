/**
 * Auth API Integration Tests
 *
 * Tests authentication endpoints against the real API.
 * No mocking — hits localhost:8787 with real D1 database.
 */

import { test, expect } from "@playwright/test";
import { USERS, loginAs } from "./helpers";

const API_URL = "http://localhost:8787";

test.describe("Auth API", () => {
  test("admin login returns valid token and CSRF token", async () => {
    const auth = await loginAs(USERS.ADMIN);
    expect(auth.token).toBeTruthy();
    expect(typeof auth.token).toBe("string");
    expect(auth.token.length).toBeGreaterThan(10);
    expect(auth.csrfToken).toBeTruthy();
  });

  test("owner login returns valid token", async () => {
    const auth = await loginAs(USERS.OWNER);
    expect(auth.token).toBeTruthy();
  });

  test("chef login returns valid token", async () => {
    const auth = await loginAs(USERS.CHEF);
    expect(auth.token).toBeTruthy();
  });

  test("service crew login returns valid token", async () => {
    const auth = await loginAs(USERS.SERVICE);
    expect(auth.token).toBeTruthy();
  });

  test("cashier login returns valid token", async () => {
    const auth = await loginAs(USERS.CASHIER);
    expect(auth.token).toBeTruthy();
  });

  test("login with wrong password fails", async () => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USERS.ADMIN, password: "wrongpassword" }),
    });
    expect(res.ok).toBe(false);
  });

  test("login with nonexistent user fails", async () => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "nonexistent_user_xyz",
        password: "password123",
      }),
    });
    expect(res.ok).toBe(false);
  });

  test("authenticated request with valid token succeeds", async () => {
    const auth = await loginAs(USERS.OWNER);

    const res = await fetch(`${API_URL}/api/v1/orders?limit=1`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("authenticated request without token fails", async () => {
    const res = await fetch(`${API_URL}/api/v1/orders?limit=1`);
    expect(res.ok).toBe(false);
  });
});
