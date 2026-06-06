import { expect, test } from "@playwright/test";

test("preview server serves a renderable app shell", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBe(true);
  const appShell = page.locator("#app[data-v-app]");
  await expect(appShell).toBeVisible();
  await expect(appShell).not.toBeEmpty();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});
