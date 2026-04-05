/**
 * Feedback Module Integration Tests
 *
 * Submits 2 feedbacks each for grandmaShop, japanShop, thaiShop.
 * Then verifies owner isolation (cross-shop 403) and admin stats.
 * Hits the real API at localhost:8787 with real D1 database.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const API_URL = "http://localhost:8787";

// ─── Feedback payloads per shop ───────────────────────────────────────────
const GRANDMA_FEEDBACKS = [
  {
    subject: "Menu item images not showing after upload",
    description:
      "After I upload a photo for a menu item, the image never appears in the customer-facing menu. The filename is accepted but the preview stays blank. This has been happening for 3 days and affects all new menu items I try to add photos to. Customers are confused because they cannot see what the dish looks like.",
    category: "bug_report",
    priority: "high",
    relatedModule: "menu",
  },
  {
    subject: "Add week-over-week sales comparison to Analytics",
    description:
      "Currently the analytics page only shows daily revenue totals. A week-over-week comparison chart would help me quickly see if this week is performing better or worse than last week. Many of my regulars come on specific days so this view would be very helpful for planning staff schedules and ingredient orders in advance.",
    category: "feature_request",
    priority: "medium",
    relatedModule: "analytics",
  },
] as const;

const JAPAN_FEEDBACKS = [
  {
    subject: "Reservation confirmation email sent twice",
    description:
      "Customers are receiving duplicate confirmation emails every time they make a reservation. We have received complaints from several guests this week. This appears to happen for both dine-in and takeaway reservations. Please investigate the email notification logic as it is causing confusion and undermining trust with our guests.",
    category: "bug_report",
    priority: "urgent",
    relatedModule: "reservations",
  },
  {
    subject: "Allow customizing table layout with drag and drop",
    description:
      "Our restaurant has an irregular floor plan with a private tatami room and outdoor seating area. The current table management grid does not reflect our actual layout, making it hard to communicate seating to our staff. A drag-and-drop table layout editor with room labels would greatly improve our daily floor operations.",
    category: "feature_request",
    priority: "medium",
    relatedModule: "tables",
  },
] as const;

const THAI_FEEDBACKS = [
  {
    subject: "POS checkout freezes when applying discount coupon",
    description:
      "When the cashier tries to apply a discount coupon during checkout in the POS system, the screen freezes for about 10 to 15 seconds before responding. This causes long queues during peak hours. The issue seems to happen only with percentage-based coupons. Fixed-amount coupons work fine. Please fix this as it slows down our service significantly.",
    category: "bug_report",
    priority: "high",
    relatedModule: "pos",
  },
  {
    subject: "Add Thai language support to customer-facing menu",
    description:
      "Most of our customers are Thai speakers but the customer ordering interface is only available in English and Chinese. Adding Thai language support would make it much easier for our regular customers to browse and order. We would be happy to help with the translation if needed. This feature would be a major improvement for our shop.",
    category: "feature_request",
    priority: "high",
    relatedModule: "menu",
  },
] as const;

// ─── Auth cache (avoid repeat logins for the same user in one run) ───────
const authCache = new Map<string, { token: string; csrfToken: string; csrfCookie: string }>();
async function loginOnce(username: string) {
  if (authCache.has(username)) return authCache.get(username)!;
  const auth = await loginAs(username);
  authCache.set(username, auth);
  return auth;
}

// ─── Helper ───────────────────────────────────────────────────────────────
function authHeaders(token: string, csrfToken: string, csrfCookie: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-CSRF-Token": csrfToken,
    Cookie: csrfCookie,
    Origin: API_URL,
  };
}

async function postFeedback(
  token: string,
  csrfToken: string,
  csrfCookie: string,
  payload: Record<string, unknown>,
) {
  return fetch(`${API_URL}/api/v1/feedback`, {
    method: "POST",
    headers: authHeaders(token, csrfToken, csrfCookie),
    body: JSON.stringify(payload),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test.describe("Feedback Module — Owner Submissions & Isolation", () => {
  // ── grandmaShop: feedback 1 ──────────────────────────────────────────
  test("grandmaShop submits feedback 1: bug report — menu images not showing", async () => {
    const auth = await loginOnce("grandmaShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, GRANDMA_FEEDBACKS[0]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string; category: string; priority: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(GRANDMA_FEEDBACKS[0].subject);
    expect(json.data.category).toBe("bug_report");
    expect(json.data.priority).toBe("high");
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── grandmaShop: feedback 2 ──────────────────────────────────────────
  test("grandmaShop submits feedback 2: feature request — analytics comparison", async () => {
    const auth = await loginOnce("grandmaShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, GRANDMA_FEEDBACKS[1]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string; category: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(GRANDMA_FEEDBACKS[1].subject);
    expect(json.data.category).toBe("feature_request");
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── japanShop: feedback 1 ────────────────────────────────────────────
  test("japanShop submits feedback 1: bug report — duplicate confirmation email", async () => {
    const auth = await loginOnce("japanShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, JAPAN_FEEDBACKS[0]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string; priority: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(JAPAN_FEEDBACKS[0].subject);
    expect(json.data.priority).toBe("urgent");
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── japanShop: feedback 2 ────────────────────────────────────────────
  test("japanShop submits feedback 2: feature request — table layout editor", async () => {
    const auth = await loginOnce("japanShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, JAPAN_FEEDBACKS[1]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string; relatedModule: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(JAPAN_FEEDBACKS[1].subject);
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── thaiShop: feedback 1 ─────────────────────────────────────────────
  test("thaiShop submits feedback 1: bug report — POS coupon freeze", async () => {
    const auth = await loginOnce("thaiShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, THAI_FEEDBACKS[0]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string; category: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(THAI_FEEDBACKS[0].subject);
    expect(json.data.category).toBe("bug_report");
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── thaiShop: feedback 2 ─────────────────────────────────────────────
  test("thaiShop submits feedback 2: feature request — Thai language support", async () => {
    const auth = await loginOnce("thaiShop");
    const res = await postFeedback(auth.token, auth.csrfToken, auth.csrfCookie, THAI_FEEDBACKS[1]);

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      success: boolean;
      data: { id: number; subject: string };
    };
    expect(json.success).toBe(true);
    expect(json.data.subject).toBe(THAI_FEEDBACKS[1].subject);
    expect(json.data.id).toBeGreaterThan(0);
  });

  // ── Cross-shop isolation ─────────────────────────────────────────────
  test("owner list is scoped: grandmaShop only sees own restaurant feedbacks", async () => {
    const auth = await loginOnce("grandmaShop");
    const res = await fetch(`${API_URL}/api/v1/feedback`, {
      headers: authHeaders(auth.token, auth.csrfToken, auth.csrfCookie),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      feedback: Array<{ restaurantId: string }>;
    };
    expect(json.success).toBe(true);
    expect(json.feedback.length).toBeGreaterThan(0);

    const uniqueRestaurants = new Set(json.feedback.map((f) => f.restaurantId));
    expect(uniqueRestaurants.size).toBe(1); // only one restaurant
  });

  test("japanShop cannot read grandmaShop feedback — returns 403", async () => {
    // Get a grandmaShop feedback ID
    const grandmaAuth = await loginOnce("grandmaShop");
    const listRes = await fetch(`${API_URL}/api/v1/feedback?limit=1`, {
      headers: authHeaders(grandmaAuth.token, grandmaAuth.csrfToken, grandmaAuth.csrfCookie),
    });
    const listJson = (await listRes.json()) as {
      feedback: Array<{ id: number }>;
    };
    expect(listJson.feedback.length).toBeGreaterThan(0);
    const grandmaFeedbackId = listJson.feedback[0].id;

    // japanShop tries to access it
    const japanAuth = await loginOnce("japanShop");
    const res = await fetch(`${API_URL}/api/v1/feedback/${grandmaFeedbackId}`, {
      headers: authHeaders(japanAuth.token, japanAuth.csrfToken, japanAuth.csrfCookie),
    });
    expect(res.status).toBe(403);

    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FEEDBACK_ACCESS_DENIED");
  });

  // ── Admin sees everything ────────────────────────────────────────────
  test("admin GET /feedback returns feedbacks from multiple restaurants", async () => {
    const auth = await loginOnce("admin");
    const res = await fetch(`${API_URL}/api/v1/feedback?limit=100`, {
      headers: authHeaders(auth.token, auth.csrfToken, auth.csrfCookie),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      feedback: Array<{ restaurantId: string }>;
      pagination: { total: number };
    };
    expect(json.success).toBe(true);

    const uniqueRestaurants = new Set(json.feedback.map((f) => f.restaurantId));
    expect(uniqueRestaurants.size).toBeGreaterThanOrEqual(2);
  });

  test("admin GET /feedback/stats returns aggregated counts", async () => {
    const auth = await loginOnce("admin");
    const res = await fetch(`${API_URL}/api/v1/feedback/stats`, {
      headers: authHeaders(auth.token, auth.csrfToken, auth.csrfCookie),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: {
        total: number;
        byStatus: Record<string, number>;
        byCategory: Record<string, number>;
        byPriority: Record<string, number>;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.total).toBeGreaterThanOrEqual(6);
    expect(json.data.byStatus).toBeDefined();
    expect(json.data.byCategory.bug_report).toBeGreaterThanOrEqual(3);
    expect(json.data.byCategory.feature_request).toBeGreaterThanOrEqual(3);
  });

  test("owner cannot access /feedback/stats — returns 403", async () => {
    const auth = await loginOnce("grandmaShop");
    const res = await fetch(`${API_URL}/api/v1/feedback/stats`, {
      headers: authHeaders(auth.token, auth.csrfToken, auth.csrfCookie),
    });
    expect(res.status).toBe(403);
  });
});
