import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import { expectNoAxeViolations, RIDGE_URL } from "./support";

const EXAMPLE = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

// Every estimate this run saves is labelled with a unique tag, and afterwards every estimate with that
// tag is deleted from both sets, even when a test failed half-way, so the demo's history stays clean.
const RUN = `e2e-${Date.now().toString(36)}`;

async function saveEstimate(request: APIRequestContext, label: string, features = EXAMPLE) {
  const response = await request.post("/estimator-api/api/v1/estimates", { data: { label, features } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return id;
}

test.afterAll(async ({ request }) => {
  for (const base of ["", RIDGE_URL]) {
    const response = await request.get(`${base}/estimator-api/api/v1/estimates?limit=100`);
    const { items } = (await response.json()) as { items: { id: string; label: string | null }[] };
    for (const { id } of items.filter((item) => item.label?.startsWith(`${RUN} `))) {
      await request.delete(`${base}/estimator-api/api/v1/estimates/${id}`);
    }
  }
});

async function submitForm(page: Page) {
  await page.getByRole("button", { name: "Estimate price" }).click();
}

test.describe("estimate form", () => {
  test("prices the example home, shows the result and saves it to the history", async ({ page }) => {
    const label = `${RUN} form`;
    await page.goto("/estimator");
    await page.getByLabel(/^Label/).fill(label);
    await submitForm(page);

    const result = page.getByRole("region", { name: label });
    await expect(result.getByText(/^\$\d{3},\d{3}$/).first()).toBeVisible();
    await expect(result.getByRole("figure", { name: "Where this estimate sits among the homes sold" })).toBeVisible();
    // The contribution chart is the Ridge set's only: under plain OLS its bars mislead.
    await expect(result.getByRole("figure", { name: "What moves this estimate" })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await result.getByRole("link", { name: "history" }).click();
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  });

  test("summarises invalid fields and moves focus to the first", async ({ page }) => {
    await page.goto("/estimator");
    const area = page.getByLabel(/^Living area/);
    await area.fill("");
    await page.getByLabel(/^Bathrooms/).fill("2.3");
    await submitForm(page);

    const summary = page.getByRole("alert").filter({ hasText: "fields need attention" });
    await expect(summary).toContainText("Living area: Enter the living area");
    await expect(summary).toContainText("Bathrooms: Use steps of 0.5");
    await expect(area).toBeFocused();
    await expect(area).toHaveAttribute("aria-invalid", "true");
    await expectNoAxeViolations(page);
  });

  test("says when the model can't price a home", async ({ page }) => {
    // Valid values, but plain OLS predicts $0 or less for them (its living-area coefficient is negative).
    await page.goto("/estimator");
    await page.getByLabel(/^Living area/).fill("4100");
    await page.getByLabel(/^Lot size/).fill("7025");
    await submitForm(page);
    await expect(page.getByRole("alert").filter({ hasText: "The model can't price this home" })).toBeVisible();
  });

  test("the Ridge set prices the same home and shows what moves the estimate", async ({ page }) => {
    const label = `${RUN} ridge`;
    await page.goto(`${RIDGE_URL}/estimator`);
    await page.getByLabel(/^Label/).fill(label);
    await submitForm(page);
    const result = page.getByRole("region", { name: label });
    await expect(result.getByRole("figure", { name: "What moves this estimate" })).toBeVisible();
    await expect(result.getByText(/Model ridge-\d{4}\./)).toBeVisible();
  });
});

test.describe("history and comparison", () => {
  test("a saved estimate has its own page; an unknown id gets the not-found page", async ({ page, request }) => {
    const label = `${RUN} detail`;
    const id = await saveEstimate(request, label);
    await page.goto(`/estimator/history/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Saved estimate" })).toBeVisible();
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto("/estimator/history/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Estimate not found" })).toBeVisible();
  });

  test("compares two saved estimates, then deletes one", async ({ page, request }) => {
    const a = `${RUN} A`;
    const b = `${RUN} B`;
    await saveEstimate(request, a, { ...EXAMPLE, square_footage: 1400 });
    await saveEstimate(request, b, { ...EXAMPLE, square_footage: 1700 });

    await page.goto("/estimator/history");
    await page.getByRole("button", { name: `Compare ${a}` }).click();
    await page.getByRole("button", { name: `Compare ${b}` }).click();
    await expect(page.getByRole("button", { name: `Compare ${a}` })).toHaveAttribute("aria-pressed", "true");
    const tray = page.getByRole("complementary", { name: "Comparison tray" });
    await expect(tray).toContainText("Comparing 2 of 4");

    // The tray is kept in localStorage.
    await page.reload();
    await expect(tray).toContainText("Comparing 2 of 4");
    await expectNoAxeViolations(page);

    await tray.getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/estimator\/compare\?ids=/);
    const table = page.getByRole("table", { name: /The estimates side by side/ });
    await expect(table.getByRole("columnheader", { name: new RegExp(a) })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: new RegExp(b) })).toBeVisible();
    await expect(table.getByRole("row", { name: /Living area/ })).toContainText("Highest");
    await expect(table.getByRole("row", { name: /Living area/ })).toContainText("Lowest");
    await expect(table.getByRole("row", { name: /Bedrooms/ })).toContainText("Same for all");
    await expect(page.getByRole("figure", { name: "Estimated prices" })).toBeVisible();
    await expect(page.getByRole("figure", { name: "How the homes differ" })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "the compare page fits a phone; its table scrolls on its own").toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    const compareUrl = page.url();

    await page.goto("/estimator/history");
    await page.getByRole("button", { name: `Delete ${a}` }).click();
    await page.getByRole("group", { name: `Delete ${a}?` }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: a })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: `Deleted ${a}.` })).toHaveCount(1);
    await expect(tray).toContainText("Comparing 1 of 4");

    await page.goto(compareUrl);
    await expect(page.getByText("One estimate no longer exists")).toBeVisible();
    await expect(page.getByText(/Fewer than two of these estimates are left/)).toBeVisible();
  });
});
