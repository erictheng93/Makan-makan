/**
 * Integration Test Helpers
 *
 * Shared utilities for real API integration tests.
 * All calls hit the actual running API at localhost:8787 with real D1 database.
 */

const API_URL = "http://localhost:8787";

/**
 * Generate a unique 3-digit phone suffix to avoid the active-order-per-guest rate limit.
 * Uses an incrementing counter + timestamp to guarantee no collisions within a test run.
 */
let phoneCounter = 0;
export function uniquePhone(): string {
  phoneCounter++;
  // Combine counter with last 2 digits of timestamp for cross-run uniqueness
  const base = (phoneCounter * 7 + Date.now()) % 900;
  return String(100 + base); // 100-999
}

// Seeded test data constants
export const RESTAURANT_ID = "019469a0-0001-7000-8000-000000000001";
export const TABLE_A1_ID = 1;
export const TABLE_B1_ID = 3;

// Menu item IDs (seeded in 阿嬤的味道)
export const MENU = {
  HONG_CHA: 15, // 紅茶 $20
  DONG_GUA_CHA: 13, // 冬瓜茶 $25
  GONG_WAN_TANG: 10, // 貢丸湯 $35
} as const;

// Seeded user credentials (all use password123)
export const USERS = {
  ADMIN: "admin",
  OWNER: "grandmaShop",
  CHEF: "grandma_chef1",
  SERVICE: "grandma_service1",
  CASHIER: "grandma_cashier1",
} as const;

// ─── Types ───

interface AuthCredentials {
  token: string;
  csrfToken: string;
  csrfCookie: string; // Full Set-Cookie value for double-submit pattern
}

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
    user: Record<string, unknown>;
  };
}

interface GuestOrderResponse {
  success: boolean;
  data: {
    order: {
      id: number;
      restaurantId: string;
      status: number | string;
      orderNumber?: string;
      totalAmount?: number;
      items?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    guestToken: string;
    tokenExpiresAt: string;
  };
}

interface GuestOrderDetailResponse {
  success: boolean;
  data: {
    order: {
      id: number;
      status: number | string;
      [key: string]: unknown;
    };
  };
}

interface OrderStatusResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: unknown;
}

// ─── Auth ───

/**
 * Login as a seeded user and return both the JWT token and CSRF token.
 * The CSRF token is returned in the X-CSRF-Token response header on login.
 */
export async function loginAs(username: string): Promise<AuthCredentials> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
    },
    body: JSON.stringify({ username, password: "password123" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${username}: ${res.status} ${text}`);
  }
  const data: LoginResponse = await res.json();
  if (!data.success || !data.data?.token) {
    throw new Error(`Login response missing token for ${username}`);
  }

  const csrfToken = res.headers.get("X-CSRF-Token") || "";

  // Extract csrf_token cookie value for double-submit pattern
  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  let csrfCookie = "";
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/csrf_token=([^;]+)/);
    if (match) {
      csrfCookie = `csrf_token=${match[1]}`;
      break;
    }
  }
  // Fallback: if cookie not found, use the header token as cookie value
  if (!csrfCookie && csrfToken) {
    csrfCookie = `csrf_token=${csrfToken}`;
  }

  return { token: data.data.token, csrfToken, csrfCookie };
}

// ─── Guest Orders ───

/**
 * Create a guest order via the public guest-orders endpoint.
 * Returns the full response including order and guestToken.
 */
export async function createGuestOrder(
  restaurantId: string,
  items: Array<{ menuItemId: number; quantity: number }>,
  options: {
    orderType?: "shop" | "table" | "seat";
    tableId?: number;
    guestName?: string;
    phoneLastDigits?: string;
    notes?: string;
    deliveryInfo?: {
      type: "dine_in" | "takeaway" | "delivery";
      address?: string;
      phone?: string;
    };
  } = {},
): Promise<GuestOrderResponse> {
  const body: Record<string, unknown> = {
    restaurantId,
    orderType: options.orderType ?? "shop",
    items,
    guestName: options.guestName ?? "E2E Test",
    phoneLastDigits: options.phoneLastDigits ?? uniquePhone(),
  };
  if (options.tableId != null) body.tableId = options.tableId;
  if (options.notes) body.notes = options.notes;
  if (options.deliveryInfo) body.deliveryInfo = options.deliveryInfo;

  const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `createGuestOrder failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data as GuestOrderResponse;
}

/**
 * Get a guest order by ID using the guest token.
 * The guest token auth middleware expects `Authorization: Bearer gt_xxx`.
 */
export async function getGuestOrder(
  orderId: number,
  guestToken: string,
): Promise<GuestOrderDetailResponse> {
  const res = await fetch(`${API_URL}/api/v1/guest-orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${guestToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `getGuestOrder(${orderId}) failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data as GuestOrderDetailResponse;
}

// ─── Authenticated Order Operations ───

/**
 * Update an order's status using the authenticated orders endpoint.
 * Requires auth credentials (JWT + CSRF token).
 * Status is a string: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "paid" | "cancelled"
 */
export async function updateOrderStatus(
  orderId: number,
  status: string,
  auth: AuthCredentials,
): Promise<OrderStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
      Origin: API_URL,
      "X-CSRF-Token": auth.csrfToken,
      Cookie: auth.csrfCookie,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `updateOrderStatus(${orderId}, ${status}) failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data as OrderStatusResponse;
}

/**
 * Cancel (delete) an order. Requires admin or owner credentials.
 */
export async function cancelOrder(
  orderId: number,
  auth: AuthCredentials,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Origin: API_URL,
      "X-CSRF-Token": auth.csrfToken,
      Cookie: auth.csrfCookie,
    },
  });
  // Ignore failures during cleanup — order might already be cancelled
  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `cancelOrder(${orderId}) cleanup warning: ${res.status} ${text}`,
    );
  }
}

/**
 * Get an order by ID using authenticated endpoint (GET, no CSRF needed).
 */
export async function getOrder(
  orderId: number,
  auth: AuthCredentials,
): Promise<{ success: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      `getOrder(${orderId}) failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data;
}

// ─── Cleanup ───

/**
 * Clean up: cancel an order via the admin user if it exists.
 * Safe to call even if order was already cleaned up.
 */
export async function cleanupOrder(orderId: number | undefined): Promise<void> {
  if (!orderId) return;
  try {
    const adminAuth = await loginAs(USERS.ADMIN);
    await cancelOrder(orderId, adminAuth);
  } catch {
    // Swallow errors during cleanup
  }
}
