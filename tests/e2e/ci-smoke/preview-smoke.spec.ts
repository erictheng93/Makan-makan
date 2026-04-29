import { expect, test } from "@playwright/test";

test("preview server returns browser-renderable HTML", async ({ page }) => {
  const response = await page.goto("/");

  expect(response, "preview root response").not.toBeNull();
  expect(response!.status(), "preview root status").toBeLessThan(400);

  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
});
