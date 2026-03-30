import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockAllAPIs,
} from "./helpers/visual-test-utils";
import { checkDesignSystem } from "./helpers/design-system-checks";

const APP_PAGES = [
  { name: "Admin Dashboard", url: `${APP_URLS.admin}/login` },
  { name: "Customer App", url: `${APP_URLS.customer}/` },
  { name: "Kitchen Display", url: `${APP_URLS.kitchen}/login` },
  { name: "Management Portal", url: `${APP_URLS.management}/` },
  { name: "Onboarding App", url: `${APP_URLS.onboarding}/` },
];

test.describe("Design System Compliance — Apple-Native Soft Minimalism", () => {
  for (const app of APP_PAGES) {
    test(`${app.name} — design system check`, async ({ page }) => {
      await mockAllAPIs(page);
      await page.goto(app.url);
      await waitForPageStable(page);

      const violations = await checkDesignSystem(page);
      expect(
        violations,
        `Design system violations in ${app.name}:\n${violations.join("\n")}`,
      ).toHaveLength(0);
    });
  }
});
