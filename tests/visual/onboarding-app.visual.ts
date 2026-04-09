import { test, expect } from "@playwright/test";
import {
  APP_URLS,
  waitForPageStable,
  mockDynamicContent,
  mockAllAPIs,
  expectPageRendered,
} from "./helpers/visual-test-utils";

const BASE_URL = APP_URLS.onboarding; // http://localhost:3011

test.describe("Onboarding App — Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  test("home page", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForPageStable(page);
    await expectPageRendered(page, { mustContain: /MakanMakan/ });
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-home.png");
  });

  test("application form", async ({ page }) => {
    await page.goto(`${BASE_URL}/apply`);
    await waitForPageStable(page);
    await expectPageRendered(page);
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-apply.png");
  });

  // ConnectView and SuccessView check onboarding store state in onMounted and
  // redirect to /apply when the flow hasn't been started yet. The store
  // hydrates from sessionStorage via loadFromSession() at construction time,
  // so pre-seeding the expected shape via addInitScript avoids the redirect.
  const seedOnboardingSession = async (
    page: import("@playwright/test").Page,
    completionResult: { tenantId: string; subdomain: string } | null,
  ) => {
    const application = {
      businessName: "Visual Test Restaurant",
      contactName: "Visual Tester",
      contactEmail: "visual@test.local",
      contactPhone: "+886-2-0000-0000",
      planId: "standard",
      subdomain: "visual-test",
      status: completionResult ? "completed" : "submitted",
    };
    const sessionData = {
      application,
      applicationId: "visual-test-application-id",
      assignedSubdomain: "visual-test",
      completionResult,
    };
    await page.addInitScript((data) => {
      sessionStorage.setItem("onboarding_application", JSON.stringify(data));
    }, sessionData);
  };

  test("connect page", async ({ page }) => {
    // Connect view needs applicationId in the onboarding store
    await seedOnboardingSession(page, null);
    await page.goto(`${BASE_URL}/connect`);
    await waitForPageStable(page);
    await expectPageRendered(page, {
      urlContains: "/connect",
    });
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-connect.png");
  });

  test("success page", async ({ page }) => {
    // Success view needs completionResult in the onboarding store
    await seedOnboardingSession(page, {
      tenantId: "visual-test-tenant-id",
      subdomain: "visual-test",
    });
    await page.goto(`${BASE_URL}/success`);
    await waitForPageStable(page);
    await expectPageRendered(page, {
      urlContains: "/success",
    });
    await mockDynamicContent(page);
    await expect(page).toHaveScreenshot("onboarding-success.png");
  });
});
