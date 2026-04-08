/**
 * Discovery / Search Flow
 *
 * Tests the /discover page: restaurant listing, search, no-results state,
 * and navigation to a restaurant from a result card.
 */

import { test, expect, devices } from "@playwright/test";
import { RESTAURANT, MENU_ITEMS } from "../../helpers/personas";

test.use({ ...devices["iPhone 12"] });

const API = "**/api/v1";
const API_RE = "/api/v1";

const POPULAR_RESTAURANTS = [
  {
    restaurantId: RESTAURANT.id,
    name: RESTAURANT.name,
    type: "複合式",
    district: "信義區",
    imageUrl: RESTAURANT.logoUrl,
    rating: 4.9,
    isOpen: true,
  },
  {
    restaurantId: "rest-002",
    name: "櫻花亭",
    type: "日式",
    district: "南屯區",
    imageUrl: "https://placehold.co/200x200?text=Sakura",
    rating: 4.8,
    isOpen: false,
  },
];

function json(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// Helper to build a properly-shaped DishSearchResult (DishResultCard requires
// dishName and tags — missing fields cause runtime crashes)
function mockDish(m: (typeof MENU_ITEMS)[0]) {
  return {
    menuItemId: m.id,
    dishName: m.name, // DishResultCard uses dish.dishName, not dish.name
    price: m.price,
    restaurantId: RESTAURANT.id,
    restaurantName: RESTAURANT.name,
    imageUrl: m.imageUrl,
    categoryName: null,
    district: null,
    isOpen: true,
    supportsTakeaway: true,
    supportsDelivery: false,
    tags: [], // DishResultCard does dish.tags.length — must not be undefined
  };
}

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/discovery/popular`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          keywords: ["牛肉麵", "珍珠奶茶"],
          dishes: MENU_ITEMS.slice(0, 2).map(mockDish),
          restaurants: POPULAR_RESTAURANTS,
        },
      }),
    ),
  );

  // No `$` end anchor — the store passes query params like ?page=1
  await page.route(
    new RegExp(`${API_RE}/discovery/restaurants(\\?|$)`),
    (route) =>
      route.fulfill(
        json({
          success: true,
          data: {
            results: POPULAR_RESTAURANTS,
            total: POPULAR_RESTAURANTS.length,
          },
        }),
      ),
  );

  await page.route(new RegExp(`${API_RE}/discovery/search`), (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q") || "";

    if (
      query.toLowerCase().includes("牛肉") ||
      query.toLowerCase().includes("noodle")
    ) {
      route.fulfill(
        json({
          success: true,
          data: { results: [mockDish(MENU_ITEMS[0])], total: 1 },
        }),
      );
    } else {
      route.fulfill(json({ success: true, data: { results: [], total: 0 } }));
    }
  });
});

test.describe("Discovery / Search feature", () => {
  // -----------------------------------------------------------------------
  // 1. Discovery page loads with restaurant list
  // -----------------------------------------------------------------------

  test("should display discovery page with popular restaurants", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // Heading visible
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 8000 });

    // Search input present
    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('input[placeholder*="搜尋"]'))
      .or(page.locator('input[placeholder*="Search"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 8000 });

    // At least one restaurant name visible
    const restaurantName = page
      .locator(`text=${RESTAURANT.name}`)
      .or(page.locator("text=櫻花亭"));
    await expect(restaurantName.first()).toBeVisible({ timeout: 10000 });
  });

  // -----------------------------------------------------------------------
  // 2. Reach discover from home page
  // -----------------------------------------------------------------------

  test("should reach discover page from home page via Explore button", async ({
    page,
  }) => {
    await page.goto("/");

    const exploreBtn = page
      .locator('a[href="/discover"]')
      .or(page.locator('a:has-text("探索")'))
      .or(page.locator('button:has-text("探索")'));
    await expect(exploreBtn.first()).toBeVisible({ timeout: 5000 });
    await exploreBtn.first().click();

    await expect(page).toHaveURL(/\/discover/, { timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // 3. Search results appear for a matching query
  // -----------------------------------------------------------------------

  test("should show search results when querying a dish name", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('input[placeholder*="搜尋"]'))
      .or(page.locator('input[placeholder*="Search"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 8000 });

    await searchInput.first().fill("牛肉");
    await searchInput.first().press("Enter");

    // Dish result should appear
    await expect(
      page.locator(`text=${MENU_ITEMS[0].name}`).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  // -----------------------------------------------------------------------
  // 4. No-results state
  // -----------------------------------------------------------------------

  test("should display no-results state for unmatched query", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .locator('input[type="search"]')
      .or(page.locator('input[placeholder*="搜尋"]'))
      .or(page.locator('input[placeholder*="Search"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 8000 });

    await searchInput.first().fill("xyzzy_nonexistent_12345");
    await searchInput.first().press("Enter");

    // Empty / no-results indicator
    const noResults = page
      .locator("text=/沒有結果/")
      .or(page.locator("text=/找不到/"))
      .or(page.locator("text=/No result/"))
      .or(page.locator('[data-testid="no-results"]'));
    await expect(noResults.first()).toBeVisible({ timeout: 8000 });
  });

  // -----------------------------------------------------------------------
  // 5. Filter panel opens
  // -----------------------------------------------------------------------

  test("should show filter options on the discovery page", async ({ page }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // The filter button should be visible
    const filterBtn = page
      .locator('button:has-text("篩選")')
      .or(page.locator('button:has-text("Filters")'))
      .or(page.locator('[data-testid="filter-btn"]'));
    await expect(filterBtn.first()).toBeVisible({ timeout: 8000 });

    // Click to expand/toggle the filter panel
    await filterBtn.first().click();

    // Filter options should appear after clicking
    const filterOptions = page
      .locator('button:has-text("現在開業")')
      .or(page.locator('button:has-text("Open Now")'))
      .or(page.locator('button:has-text("外帶")'))
      .or(page.locator('button:has-text("Takeaway")'))
      .or(page.locator('button:has-text("外送")'))
      .or(page.locator('button:has-text("Delivery")'));
    await expect(filterOptions.first()).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // 6. Restaurant card navigates to restaurant page
  // -----------------------------------------------------------------------

  test("should navigate to restaurant when clicking a restaurant card", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.waitForLoadState("networkidle");

    // Wait for restaurant card
    const restaurantCard = page.locator(`text=${RESTAURANT.name}`).first();
    await expect(restaurantCard).toBeVisible({ timeout: 10000 });
    await restaurantCard.click();

    // Should navigate somewhere related to the restaurant
    await expect(page).toHaveURL(new RegExp(`/restaurant/${RESTAURANT.id}`), {
      timeout: 8000,
    });
  });
});
