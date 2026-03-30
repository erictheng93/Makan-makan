import type { Page } from "@playwright/test";

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
 */
export async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");

  // 注入停用動畫 CSS
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

  // 等待字型載入完成
  await page.evaluate(() => document.fonts.ready);

  // 額外等待確保渲染完成
  await page.waitForTimeout(300);
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
 * 模擬登入不同角色
 *
 * 透過注入 localStorage token 來模擬已登入狀態，
 * 並 mock auth API 回應以避免後端依賴
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
  const mockToken = `visual-test-token-${role}`;

  // Mock auth API 回應
  await page.route("**/api/v1/auth/**", (route) => {
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

  // Mock user profile API
  await page.route("**/api/v1/users/me", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: user }),
    });
  });

  // 注入 auth state 到 localStorage
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, userData }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", `refresh-${token}`);
      localStorage.setItem("user", JSON.stringify(userData));
    },
    { token: mockToken, userData: user },
  );
}

/**
 * Mock 通用 API 回應，避免後端依賴
 *
 * 攔截所有 API 呼叫並回傳空的成功回應，
 * 個別測試可在呼叫此函式後覆蓋特定 route
 */
export async function mockAllAPIs(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();

    // 菜單項目
    if (url.includes("/menu/") && url.includes("/items")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "item-1",
              name: "海南雞飯",
              price: 120,
              category: "主食",
              description: "正宗海南雞飯",
              imageUrl: "",
              isAvailable: true,
            },
            {
              id: "item-2",
              name: "叻沙",
              price: 150,
              category: "湯麵",
              description: "椰漿叻沙",
              imageUrl: "",
              isAvailable: true,
            },
            {
              id: "item-3",
              name: "肉骨茶",
              price: 180,
              category: "湯品",
              description: "藥材肉骨茶",
              imageUrl: "",
              isAvailable: false,
            },
          ],
        }),
      });
    }

    // 訂單列表
    if (url.includes("/orders")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
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
          ],
        }),
      });
    }

    // 餐廳資訊
    if (url.includes("/restaurants/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "test-restaurant-1",
            name: "MakanMakan 測試餐廳",
            description: "視覺測試用餐廳",
            address: "台北市信義區",
            isOpen: true,
          },
        }),
      });
    }

    // 預設：回傳空成功回應
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}
