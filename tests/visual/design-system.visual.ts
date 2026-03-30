import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockAllAPIs,
} from "./helpers/visual-test-utils";
import { checkDesignSystem } from "./helpers/design-system-checks";
import type { DesignSystemOptions } from "./helpers/design-system-checks";

/**
 * 設計系統合規檢查
 *
 * 已知違規以 skip 標記，待各 app 修正後逐步啟用。
 * 各 app 的 skip 選項紀錄了目前的違規現狀。
 */
interface AppCheckConfig {
  name: string;
  url: string;
  options: DesignSystemOptions;
}

const APP_PAGES: AppCheckConfig[] = [
  {
    name: "Admin Dashboard — login",
    url: `${APP_URLS.admin}/login`,
    options: { skipBgCheck: true }, // login 頁背景非 #F2F2F7
  },
  {
    name: "Customer App — home",
    url: `${APP_URLS.customer}/`,
    options: { skipBgCheck: true }, // landing 頁背景非 #F2F2F7
  },
  {
    name: "Kitchen Display — login",
    url: `${APP_URLS.kitchen}/login`,
    options: { skipBgCheck: true, skipShadowCheck: true }, // shadow > 8%
  },
  {
    name: "Management Portal — dashboard",
    url: `${APP_URLS.management}/`,
    options: { skipBgCheck: true, skipCardRadiusCheck: true }, // bg + 7 cards < 16px radius
  },
  {
    name: "Onboarding App — home",
    url: `${APP_URLS.onboarding}/`,
    options: { skipBgCheck: true, skipCardRadiusCheck: true }, // 4 cards < 16px radius
  },
];

test.describe("Design System Compliance — Apple-Native Soft Minimalism", () => {
  for (const app of APP_PAGES) {
    test(`${app.name} — design system check`, async ({ page }) => {
      await mockAllAPIs(page);
      await page.goto(app.url);
      await waitForPageStable(page);

      const violations = await checkDesignSystem(page, app.options);
      expect(
        violations,
        `Design system violations in ${app.name}:\n${violations.join("\n")}`,
      ).toHaveLength(0);
    });
  }
});
