import { expect, type Page } from "@playwright/test";

/**
 * App URL 對照表（對應各 app 的 vite dev/preview port）
 */
export const APP_URLS = {
  customer: "http://localhost:3000",
  admin: "http://localhost:3001",
  kitchen: "http://localhost:3002",
  management: "http://localhost:3010",
  onboarding: "http://localhost:3011",
} as const;

/**
 * 停用所有 CSS 動畫和 transition，確保截圖一致性
 */
const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  /* 隱藏游標閃爍 */
  * { caret-color: transparent !important; }
`;

/**
 * 等待頁面穩定（網路閒置 + 停用動畫 + 字型載入）
 *
 * Notes:
 * - `networkidle` is best-effort. Kitchen display has SSE/WebSocket polling
 *   that never lets the page go idle, so we cap the wait and fall back to
 *   `load` state rather than failing the test.
 * - We wait for `document.fonts.ready` rather than trusting `load`, because
 *   web fonts often load via `font-display: swap` and arrive after `load`.
 */
export async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  try {
    await page.waitForLoadState("networkidle", { timeout: 3000 });
  } catch {
    // Pages with live SSE/WebSocket connections never reach networkidle —
    // `load` + the font wait below is good enough for screenshots.
  }

  // 注入停用動畫 CSS
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

  // 等待字型載入完成
  await page.evaluate(() => document.fonts.ready);

  // 額外等待確保渲染完成
  await page.waitForTimeout(300);
}

/**
 * Assert that a page rendered its intended content, not a generic failure state.
 *
 * **Why this exists**: Playwright's `toHaveScreenshot()` freezes whatever is on
 * screen as the baseline on its first run. Without any content assertion, three
 * classes of bugs become permanently "valid" baselines:
 *
 *   1. Module-init crashes (TDZ, circular chunks, missing env vars) → error
 *      page or blank page. `toHaveScreenshot` happily captures "An Error
 *      Occurred" / white canvas as the baseline, and future runs of the same
 *      broken page pass because they match the broken baseline.
 *   2. Auth mocks silently broken → authenticated tests redirect to /login.
 *      The login page gets captured as every authenticated baseline, and no
 *      one notices until they look at the actual pixels.
 *   3. Blank pages from mount failure — same as (1), but with zero content.
 *
 * Call this helper BEFORE `toHaveScreenshot()` in every test. Failures here
 * abort the test before a bad baseline is written.
 */
export async function expectPageRendered(
  page: Page,
  options: {
    /** Fail if the final URL contains this. Typically `/login` for authenticated pages. */
    notAt?: string;
    /** Fail unless the final URL contains this. Catches silent redirects to a fallback route. */
    urlContains?: string;
    /** Fail unless this locator is visible. Preferred form of proof. */
    visible?: string;
    /** Fail unless page body contains this (text or regex). Cheaper than a locator. */
    mustContain?: string | RegExp;
  } = {},
): Promise<void> {
  const url = page.url();

  // (1) Never the generic error route — catches module-init crashes + route
  // loading failures that got caught by router.onError.
  if (/\/error(\?|$|#)/.test(url)) {
    throw new Error(
      `[expectPageRendered] page redirected to error route: ${url}\n` +
        `  This is usually a module-init crash (missing env var, TDZ,\n` +
        `  circular chunk), a bad mock response shape, or a route that\n` +
        `  threw synchronously. Inspect the preview server logs and\n` +
        `  browser console output.`,
    );
  }

  // (2) For authenticated tests: never the login page
  if (options.notAt && url.includes(options.notAt)) {
    throw new Error(
      `[expectPageRendered] page at unexpected URL: ${url}\n` +
        `  Expected the URL NOT to contain "${options.notAt}". The most\n` +
        `  common cause is a broken auth mock (wrong localStorage key,\n` +
        `  wrong endpoint shape, or the LIFO order of page.route handlers\n` +
        `  letting a catch-all intercept /auth/me). See loginAs() in\n` +
        `  visual-test-utils.ts for the shape each app expects.`,
    );
  }

  // (2b) Positive URL match — catches silent redirects to a fallback route.
  // Example: admin/dashboard/orders silently redirecting to /dashboard/platform
  // when no restaurant is selected. The page still "renders content", but the
  // wrong content.
  if (options.urlContains && !url.includes(options.urlContains)) {
    throw new Error(
      `[expectPageRendered] page URL does not contain expected path: ${url}\n` +
        `  Expected URL to contain "${options.urlContains}". The page was\n` +
        `  probably silently redirected — common causes: missing restaurant\n` +
        `  context (sessionStorage), missing route params, or a route guard\n` +
        `  that bounces to a default landing page.`,
    );
  }

  // (3) Body must not be blank — catches complete mount failures
  const bodyText = ((await page.textContent("body")) || "").trim();
  if (bodyText.length < 10) {
    throw new Error(
      `[expectPageRendered] page body is empty (${bodyText.length} chars)\n` +
        `  This usually means a JavaScript module-init crash before mount\n` +
        `  (e.g. a "Cannot access X before initialization" TDZ error from\n` +
        `  a circular chunk). Inspect the browser console.`,
    );
  }

  // (3b) Reject known error-state text. Pages that render a "loading failed"
  // or "network error" fallback look structurally valid but are semantically
  // broken baselines. Catch them loudly.
  const KNOWN_FAILURE_PATTERNS: Array<[RegExp, string]> = [
    [/An Error Occurred/i, "generic error state"],
    [
      /Loading failed|Network connection failed/i,
      "network/load failure fallback",
    ],
    [/Route loading failed|路由載入失敗/i, "Vue Router lazy-load failure"],
  ];
  for (const [pat, label] of KNOWN_FAILURE_PATTERNS) {
    if (pat.test(bodyText)) {
      throw new Error(
        `[expectPageRendered] body matches known failure pattern (${label}):\n` +
          `  Pattern: ${pat}\n` +
          `  This is usually an incomplete API mock — the page reached a\n` +
          `  fetch and got no handler. Add the missing endpoint to\n` +
          `  mockAllAPIs() or to the test's own page.route() setup.`,
      );
    }
  }

  // (4) Positive selector check — strongest form of content proof
  if (options.visible) {
    await expect(page.locator(options.visible)).toBeVisible({
      timeout: 10_000,
    });
  }

  // (5) Text-content check — cheaper than a locator but still positive
  if (options.mustContain) {
    const pat = options.mustContain;
    const matches =
      typeof pat === "string" ? bodyText.includes(pat) : pat.test(bodyText);
    if (!matches) {
      throw new Error(
        `[expectPageRendered] body does not contain expected text\n` +
          `  Expected: ${pat}\n` +
          `  Got (first 200 chars): ${bodyText.slice(0, 200)}`,
      );
    }
  }
}

/**
 * Mock 動態內容（時間戳、計數器等），確保截圖可重現
 */
export async function mockDynamicContent(page: Page): Promise<void> {
  await page.evaluate(() => {
    // 凍結時間為固定值
    const fixedDate = new Date("2026-01-15T10:30:00Z");
    const fixedTimestamp = fixedDate.getTime();

    // 替換所有顯示「今天」日期的元素
    document
      .querySelectorAll("[data-testid*='date'], [data-testid*='time'], time")
      .forEach((el) => {
        if (el.textContent) {
          el.textContent = "2026/01/15 10:30";
        }
      });

    // 替換可能的即時計數器
    document
      .querySelectorAll("[data-testid*='count'], [data-testid*='badge-count']")
      .forEach((el) => {
        if (el.textContent?.match(/^\d+$/)) {
          el.textContent = "3";
        }
      });

    // 凍結 Date.now (影響後續 JS 執行)
    window.Date.now = () => fixedTimestamp;
  });
}

/**
 * Produce a structurally-valid JWT with a 10-year expiration. The signature
 * is not verified client-side, so any non-empty string works.
 *
 * CRITICAL: every app's auth store calls `isTokenExpired(token, 60)` during
 * hydration (`packages/utils/src/token.ts`). If the token isn't a real JWT,
 * the parser returns `true` (expired) and the store triggers a refresh path
 * that has to hit a mocked `/auth/refresh` endpoint — which is both slow
 * and fragile (shape drift across apps). Returning a valid far-future JWT
 * makes the sync hydration path succeed cleanly.
 */
function makeTestJwt(sub: string, role: number): string {
  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url({
    sub,
    iat: now,
    exp: now + 86400 * 365 * 10, // 10 years
    role,
  });
  // Signature is not verified in the browser — any string works
  const sig = "visual-test-signature-not-verified-client-side";
  return `${header}.${payload}.${sig}`;
}

/**
 * Per-app localStorage key config.
 *
 * Each frontend app uses a different prefix for its auth localStorage keys —
 * admin uses `auth_*`, customer uses `customer_*`, kitchen uses `kitchen_*`.
 * Management portal and onboarding app don't have a login flow.
 *
 * Historical bug: before 2026-04-09 this helper wrote to `token` / `user` /
 * `refreshToken` which none of the apps read, so every authenticated visual
 * test silently rendered the login page and was frozen as a valid baseline.
 */
const AUTH_STORAGE_KEYS: Record<
  string,
  { token: string; refresh: string; user: string | null } | null
> = {
  [APP_URLS.admin]: {
    token: "auth_token",
    refresh: "auth_refresh_token",
    user: "auth_user",
  },
  // NOTE: admin also needs a sessionStorage entry for the selected restaurant
  // context — see the `adminRestaurantContext` handling in loginAs() below.
  // Without it, /dashboard/* sub-routes silently fall back to Platform Overview.
  [APP_URLS.customer]: {
    token: "customer_auth_token",
    refresh: "customer_refresh_token",
    user: "customer_user",
  },
  [APP_URLS.kitchen]: {
    token: "kitchen_auth_token",
    refresh: "kitchen_refresh_token",
    user: "kitchen_user",
  },
  [APP_URLS.management]: null, // no auth flow
  [APP_URLS.onboarding]: null, // no auth flow
};

/**
 * 模擬登入不同角色
 *
 * 兩件事：
 * 1. 按 baseUrl 對應的 app，寫正確 localStorage key（見 AUTH_STORAGE_KEYS）
 * 2. Mock /auth/login、/auth/me、/auth/verify、/auth/refresh、/users/me 四個端點
 *    — 它們的 response shape 不同，必須分開 mock。/login 回傳包著 token 的
 *    wrapper，/me 回傳 user 物件本身（admin store checkAuth 會把它指派給 user.value）
 */
export async function loginAs(
  page: Page,
  role: "admin" | "owner" | "chef" | "cashier" | "customer",
  baseUrl: string,
): Promise<void> {
  const mockUsers = {
    admin: {
      id: "visual-test-admin",
      username: "admin",
      role: 0,
      restaurantId: "test-restaurant-1",
    },
    owner: {
      id: "visual-test-owner",
      username: "owner",
      role: 1,
      restaurantId: "test-restaurant-1",
    },
    chef: {
      id: "visual-test-chef",
      username: "chef",
      role: 2,
      restaurantId: "test-restaurant-1",
    },
    cashier: {
      id: "visual-test-cashier",
      username: "cashier",
      role: 4,
      restaurantId: "test-restaurant-1",
    },
    customer: {
      id: "visual-test-customer",
      username: "customer",
      role: -1,
      restaurantId: "test-restaurant-1",
    },
  };

  const user = mockUsers[role];
  const mockToken = makeTestJwt(user.id, user.role);

  // --- Mock auth endpoints (split by shape) -------------------------------
  //
  // CRITICAL: Playwright matches route handlers in LIFO order — the LAST
  // registered handler is tried first. So the catch-all for `/auth/**` must
  // be registered BEFORE the specific handlers, otherwise it swallows every
  // auth request with `{success:true, data:null}`, making admin's checkAuth
  // see `data: null` → logout → back to login page. (This was the second
  // bug frozen into every authenticated baseline.)

  // Catch-all FIRST — specific handlers below will take precedence at match time
  await page.route("**/api/v1/auth/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: null }),
    });
  });

  // /auth/login — login response wraps user with tokens
  await page.route("**/api/v1/auth/login", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          token: mockToken,
          refreshToken: `refresh-${mockToken}`,
          user,
        },
      }),
    });
  });

  // /auth/me — returns the user object directly (admin's checkAuth expects
  // response.data.data to BE the user, not wrapped)
  await page.route("**/api/v1/auth/me", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: user }),
    });
  });

  // /auth/verify — some apps use this instead of /auth/me
  await page.route("**/api/v1/auth/verify", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { valid: true, user } }),
    });
  });

  // /auth/refresh — return token + refreshToken + user. Kitchen's refresh
  // handler destructures `{ token, user }`, so `user` must be present even
  // though admin's refresh handler ignores it. Belt-and-braces shape for all
  // apps, though in practice refresh shouldn't fire at all because
  // makeTestJwt() produces a far-future expiration.
  await page.route("**/api/v1/auth/refresh", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          token: mockToken,
          refreshToken: `refresh-${mockToken}`,
          user,
        },
      }),
    });
  });

  // /users/me — same shape as /auth/me
  await page.route("**/api/v1/users/me", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: user }),
    });
  });

  // --- Inject localStorage with per-app keys ------------------------------
  //
  // CRITICAL: must use addInitScript, not evaluate-after-goto. The Vue auth
  // stores in every app hydrate at store construction time (e.g. admin
  // reads `localStorage.getItem("auth_token")` inside `useAuthStore()`).
  // If we inject after navigation, the store already captured the empty
  // localStorage and isAuthenticated stays false forever — exactly the bug
  // that let every authenticated visual test freeze a login-page baseline.
  //
  // addInitScript runs before any page script on every navigation, so the
  // localStorage keys are already set by the time `useAuthStore()` runs.

  const keys = AUTH_STORAGE_KEYS[baseUrl];
  if (!keys) {
    // App has no login flow (management, onboarding) — nothing to inject
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    return;
  }

  // Admin-only: also seed the selected-restaurant sessionStorage entry so
  // admin doesn't fall back to /dashboard/platform (Platform Overview) when
  // navigating to sub-routes like /dashboard/orders. This is per-tab state
  // in sessionStorage, not localStorage — it's keyed off UserRole.ADMIN (=0)
  // in the auth store's restaurantId computed.
  const isAdmin = baseUrl === APP_URLS.admin && role === "admin";

  await page.addInitScript(
    ({ token, userData, keys, isAdmin }) => {
      localStorage.setItem(keys.token, token);
      localStorage.setItem(keys.refresh, `refresh-${token}`);
      if (keys.user) {
        localStorage.setItem(keys.user, JSON.stringify(userData));
      }
      if (isAdmin) {
        sessionStorage.setItem(
          "admin_selected_restaurant_id",
          "test-restaurant-1",
        );
        sessionStorage.setItem(
          "admin_selected_restaurant_name",
          "Visual Test Restaurant",
        );
      }
    },
    { token: mockToken, userData: user, keys, isAdmin },
  );

  // Prime the page so callers can immediately navigate to protected routes.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
}

/**
 * Mock 通用 API 回應，避免後端依賴
 *
 * 攔截所有 API 呼叫並回傳空的成功回應，
 * 個別測試可在呼叫此函式後覆蓋特定 route
 *
 * **Matching order matters**: this function uses a single page.route handler
 * with inline dispatch, so more-specific paths must be checked BEFORE
 * broader ones (e.g. `/orders/restaurant/:id/minimum-order` must be tried
 * before the generic `/orders/` fallback — otherwise the minimum-order
 * endpoint gets an array back and the cart view silently fails).
 */
export async function mockAllAPIs(page: Page): Promise<void> {
  // --- Shared mock data ---------------------------------------------------
  const mockRestaurant = {
    id: "test-restaurant-1",
    name: "MakanMakan 測試餐廳",
    description: "視覺測試用餐廳",
    address: "台北市信義區",
    phone: "+886-2-0000-0000",
    isOpen: true,
    currency: "TWD",
    imageUrl: "",
    settings: {
      currency: "TWD",
      serviceChargeRate: 0.1,
      taxRate: 0.055,
    },
  };

  const mockCategories = [
    { id: 1, name: "主食", description: "", displayOrder: 1 },
    { id: 2, name: "湯麵", description: "", displayOrder: 2 },
    { id: 3, name: "湯品", description: "", displayOrder: 3 },
  ];

  const mockMenuItems = [
    {
      id: 1,
      restaurantId: "test-restaurant-1",
      categoryId: 1,
      name: "海南雞飯",
      description: "正宗海南雞飯",
      price: 120,
      imageUrl: "",
      isAvailable: true,
      isFeatured: true,
    },
    {
      id: 2,
      restaurantId: "test-restaurant-1",
      categoryId: 2,
      name: "叻沙",
      description: "椰漿叻沙",
      price: 150,
      imageUrl: "",
      isAvailable: true,
      isFeatured: false,
    },
    {
      id: 3,
      restaurantId: "test-restaurant-1",
      categoryId: 3,
      name: "肉骨茶",
      description: "藥材肉骨茶",
      price: 180,
      imageUrl: "",
      isAvailable: false,
      isFeatured: false,
    },
  ];

  const mockFullMenu = {
    restaurant: mockRestaurant,
    categories: mockCategories,
    menuItems: mockMenuItems,
    featuredItems: mockMenuItems.filter((i) => i.isFeatured),
  };

  const mockOrders = [
    {
      id: "order-1",
      status: "pending",
      totalAmount: 270,
      createdAt: "2026-01-15T10:00:00Z",
      items: [{ name: "海南雞飯", quantity: 1, price: 120 }],
    },
    {
      id: "order-2",
      status: "preparing",
      totalAmount: 150,
      createdAt: "2026-01-15T10:15:00Z",
      items: [{ name: "叻沙", quantity: 1, price: 150 }],
    },
  ];

  const respond = (route: any, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();

    // --- MOST SPECIFIC PATHS FIRST ---

    // Cart view: minimum order config for a restaurant
    // Must be before generic `/orders/` fallback which would return an array.
    if (/\/orders\/restaurant\/[^/]+\/minimum-order/.test(url)) {
      return respond(route, {
        success: true,
        data: { minOrderAmount: 0, enabled: false },
      });
    }

    // Customer order history: paginated response with `{orders, pagination}`.
    // Must be before generic `/orders/` fallback which would return an array.
    if (/\/customers\/me\/orders/.test(url)) {
      return respond(route, {
        success: true,
        data: {
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
      });
    }

    // Customer profile
    if (/\/customers\/me(\?|$)/.test(url)) {
      return respond(route, {
        success: true,
        data: {
          id: "visual-test-customer",
          username: "customer",
          fullName: "Visual Test Customer",
          email: null,
          phone: null,
        },
      });
    }

    // Cart view: available coupons for a restaurant
    if (/\/coupons\/available\//.test(url)) {
      return respond(route, { success: true, data: [] });
    }

    // Cart view: validate coupon code
    if (url.includes("/coupons/validate")) {
      return respond(route, {
        success: false,
        error: { code: "INVALID_COUPON", message: "Invalid coupon" },
      });
    }

    // Menu view: full restaurant menu (restaurant + categories + items + featured)
    // Pattern: /api/v1/menu/:restaurantId[?tableId=...]
    // Must be before /restaurants/ so it doesn't get intercepted there.
    if (/\/menu\/[^/]+(\?|$)/.test(url)) {
      return respond(route, { success: true, data: mockFullMenu });
    }

    // Table validation: /restaurants/:id/tables/:tableId/validate
    if (/\/restaurants\/[^/]+\/tables\/[^/]+\/validate/.test(url)) {
      return respond(route, {
        success: true,
        data: {
          isValid: true,
          table: {
            id: 1,
            number: "1",
            seats: 4,
            status: "available",
          },
          restaurant: mockRestaurant,
        },
      });
    }

    // Restaurant availability: /restaurants/:id/availability
    if (/\/restaurants\/[^/]+\/availability/.test(url)) {
      return respond(route, {
        success: true,
        data: {
          isOpen: true,
          businessHours: {
            monday: "09:00-22:00",
            tuesday: "09:00-22:00",
            wednesday: "09:00-22:00",
            thursday: "09:00-22:00",
            friday: "09:00-22:00",
            saturday: "09:00-22:00",
            sunday: "09:00-22:00",
          },
        },
      });
    }

    // Single restaurant info: /restaurants/:id (fallback for restaurants path)
    if (
      /\/restaurants\/[^/]+$/.test(url) ||
      /\/restaurants\/[^/]+\?/.test(url)
    ) {
      return respond(route, { success: true, data: mockRestaurant });
    }

    // Generic orders list (must come AFTER /orders/restaurant/.../minimum-order)
    if (url.includes("/orders")) {
      return respond(route, { success: true, data: mockOrders });
    }

    // Restaurants (generic, e.g. list)
    if (url.includes("/restaurants/")) {
      return respond(route, { success: true, data: mockRestaurant });
    }

    // 預設：回傳空成功回應
    return respond(route, { success: true, data: [] });
  });
}
