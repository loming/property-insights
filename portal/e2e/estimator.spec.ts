import { expect, type Page, test } from "@playwright/test";

import { deleteTaggedEstimates, EXAMPLE, expectNoAxeViolations, RIDGE_URL, saveEstimate } from "./support";

// Every estimate this run saves carries this tag, and is deleted afterwards.
const RUN = `e2e-${Date.now().toString(36)}`;

test.afterAll(async ({ request }) => {
  await deleteTaggedEstimates(request, RUN);
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

  test("a click straight after typing a bad value isn't lost, though the field's message moves the buttons", async ({
    page,
  }) => {
    await page.goto("/estimator");
    const rating = page.getByLabel(/^School rating/);
    await rating.fill("11");
    await page.getByRole("button", { name: "Estimate price" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "One field needs attention" })).toBeVisible();
    await expect(rating).toBeFocused();

    await page.reload();
    await rating.fill("11");
    await page.getByRole("button", { name: "Reset to the example home" }).click();
    await expect(rating).toHaveValue(String(EXAMPLE.school_rating));
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

  test("colours the highest, middle and lowest values of a row differently", async ({ page, request }) => {
    const sizes = [1400, 1550, 1700];
    const ids: string[] = [];
    for (const square_footage of sizes) {
      ids.push(await saveEstimate(request, `${RUN} ${square_footage}`, { ...EXAMPLE, square_footage }));
    }

    await page.goto(`/estimator/compare?ids=${ids.join(",")}`);
    const row = page.getByRole("table", { name: /The estimates side by side/ }).getByRole("row", { name: /Living area/ });
    const background = (text: string) =>
      row.getByRole("cell", { name: text }).evaluate((cell) => getComputedStyle(cell).backgroundColor);

    const [lowest, middle, highest] = await Promise.all(sizes.map((size) => background(size.toLocaleString("en-US"))));
    expect(new Set([lowest, middle, highest]).size).toBe(3);
    expect(middle).toBe("rgba(0, 0, 0, 0)");
    await expect(row.getByRole("cell", { name: "1,700" })).toContainText("Highest");
    await expect(row.getByRole("cell", { name: "1,400" })).toContainText("Lowest");
    await expect(row.getByRole("cell", { name: "1,550" })).not.toContainText(/Highest|Lowest/);
    await expectNoAxeViolations(page);

    // Other specs need theirs to stay on the history's first page of ten.
    for (const id of ids) {
      await request.delete(`/estimator-api/api/v1/estimates/${id}`);
    }
  });

  test("the history shows a price's warnings on hover and on keyboard focus", async ({ page, request }) => {
    const label = `${RUN} warned`;
    await saveEstimate(request, label, { ...EXAMPLE, bedrooms: 20 });

    await page.goto("/estimator/history");
    const price = page.getByRole("row", { name: label }).getByRole("button", { name: /warning/ });
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveCount(0);

    await price.hover();
    await expect(tooltip).toContainText("Bedrooms: Training data covers");
    await expectNoAxeViolations(page);

    // Escape dismisses it without moving the pointer (WCAG 1.4.13).
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);

    await page.mouse.move(0, 0);
    await price.focus();
    await expect(tooltip).toContainText("Bedrooms: Training data covers");
  });

  test.describe("on a touch screen", () => {
    test.use({ hasTouch: true });

    test("a tap shows a price's warnings", async ({ page, request }) => {
      const label = `${RUN} tapped`;
      await saveEstimate(request, label, { ...EXAMPLE, bedrooms: 20 });

      await page.goto("/estimator/history");
      await page.getByRole("row", { name: label }).getByRole("button", { name: /warning/ }).tap();
      await expect(page.getByRole("tooltip")).toContainText("Bedrooms: Training data covers");
    });
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

    // Loaded at phone width, as a phone would (charts resize a moment after a viewport change).
    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload();
    await expect(page.getByRole("figure", { name: "How the homes differ" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
        message: "the compare page fits a phone; its table scrolls on its own",
      })
      .toBeLessThanOrEqual(0);
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
