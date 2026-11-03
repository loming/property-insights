import { expect, test } from "@playwright/test";

import { expectNoAxeViolations, RIDGE_URL } from "./support";

test.describe("the shell", () => {
  test("overview links both apps and reports the services", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Property Insights");
    await expect(page.getByRole("heading", { level: 1, name: "Property Insights" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Property Value Estimator/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Property Market Analysis/ })).toBeVisible();
    const status = page.getByRole("region", { name: "Service status" });
    await expect(status.getByText("Estimator service:")).toBeVisible();
    await expect(status.getByText("Available")).toHaveCount(3);
    await expect(page.getByText("Linear regression, as briefed")).toBeVisible();
  });

  test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("navigation between and within the apps marks the current page", async ({ page }) => {
    await page.goto("/");
    const apps = page.getByRole("navigation", { name: "Applications" });
    await apps.getByRole("link", { name: "Estimator" }).click();
    await expect(page).toHaveURL(/\/estimator$/);
    await expect(apps.getByRole("link", { name: "Estimator" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "The model behind the estimates" })).toBeVisible();

    const sections = page.getByRole("navigation", { name: "Property Value Estimator sections" });
    await sections.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/estimator\/history$/);
    await expect(sections.getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");

    await apps.getByRole("link", { name: "Market" }).click();
    await expect(page).toHaveURL(/\/market$/);
    await expect(page.getByRole("heading", { level: 1, name: "Market dashboard" })).toBeVisible();
    await expect(page.getByRole("term").filter({ hasText: "Median price" })).toBeVisible();
  });

  test("an unknown address gets the not-found page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("the Ridge set is labelled as such and serves the Ridge model", async ({ page }) => {
    await page.goto(`${RIDGE_URL}/estimator`);
    await expect(page.getByText("Ridge model, recommended")).toBeVisible();
    await expect(page.getByText(/^ridge-\d{4}\./)).toBeVisible();
  });

  test("fits a 375 px phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/", "/estimator", "/estimator/history", "/market", "/market/data", "/market/what-if"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const path of [
    "/",
    "/estimator",
    "/estimator/history",
    "/estimator/compare",
    "/market",
    "/market/data",
    "/market/what-if",
    "/no-such-page",
  ]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoAxeViolations(page);
    });
  }
});
