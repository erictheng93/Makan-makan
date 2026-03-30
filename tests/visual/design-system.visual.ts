import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockAllAPIs,
} from "./helpers/visual-test-utils";
import { checkDesignSystem } from "./helpers/design-system-checks";

/**
 * 設計系統合規檢查
 *
 * 每個 app 各取一個代表頁面做 Apple-Native Soft Minimalism 規範驗證。
 */
const APP_PAGES = [
  { name: "Admin Dashboard — login", url: `${APP_URLS.admin}/login` },
  { name: "Customer App — home", url: `${APP_URLS.customer}/` },
  { name: "Kitchen Display — login", url: `${APP_URLS.kitchen}/login` },
  { name: "Management Portal — dashboard", url: `${APP_URLS.management}/` },
  { name: "Onboarding App — home", url: `${APP_URLS.onboarding}/` },
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
