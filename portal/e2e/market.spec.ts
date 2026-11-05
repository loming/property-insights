import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { expectNoAxeViolations, RIDGE_URL } from "./support";

// App 2 only reads the market data, so these tests leave nothing behind.

test.describe("market dashboard", () => {
  test("a shared link's filters apply to the controls and every widget", async ({ page }) => {
    await page.goto("/market?bedrooms=3&min_price=200000");
    await expect(page.getByText("Showing homes matching: 3 bedrooms; Price at least $200,000.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "3 bed" })).toBeChecked();
    await expect(page.getByRole("slider", { name: "Lowest price" })).toHaveAttribute("aria-valuetext", "$200,000");
    await expect(page.getByText(/^of 50 in the data$/)).toBeVisible();
    await expect(page.getByRole("figure", { name: "Median price by bedrooms" })).toContainText(
      "Every matching home is in one group: 3 bed",
    );
    await expect(page.getByRole("figure", { name: "Price against living area" })).toContainText("Price rises with living area");
    await expectNoAxeViolations(page);
  });

  test("the filter bar rewrites the URL, keeps focus, and clears", async ({ page }) => {
    await page.goto("/market");
    const lowest = page.getByRole("slider", { name: "Lowest price" });
    await lowest.focus();
    for (let i = 0; i < 8; i++) {
      await lowest.press("ArrowRight");
    }
    await expect(page).toHaveURL(/\/market\?min_price=200000$/);
    await expect(page.getByText(/^of 50 in the data$/)).toBeVisible();
    await expect(lowest).toBeFocused();

    await page.getByRole("checkbox", { name: "4 bed" }).click();
    await expect(page).toHaveURL(/bedrooms=4/);
    await page.getByLabel("Split by").selectOption("decade");
    await expect(page).toHaveURL(/segment=decade/);
    await expect(page.getByRole("figure", { name: "Median price by decade built" })).toBeVisible();

    // The tabs carry the filters, but not the dashboard's own choices.
    const tabs = page.getByRole("navigation", { name: "Property Market Analysis sections" });
    await expect(tabs.getByRole("link", { name: "Data" })).toHaveAttribute("href", "/market/data?bedrooms=4&min_price=200000");

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).toHaveURL(/\/market\?segment=decade$/);
    await expect(page.getByText("Showing every home in the data.")).toBeVisible();
  });

  test("says when no home matches", async ({ page }) => {
    await page.goto("/market?min_price=500000");
    await expect(page.getByText("No homes match these filters")).toBeVisible();
    await expect(page.getByRole("figure", { name: "Median price by bedrooms" })).toContainText("No homes match the filters.");
  });
});

test.describe("market data", () => {
  test("sorts, pages and searches the filtered homes, and exports them in that order", async ({ page }) => {
    await page.goto("/market?bedrooms=4");
    await page.getByRole("navigation", { name: "Property Market Analysis sections" }).getByRole("link", { name: "Data" }).click();
    await expect(page).toHaveURL(/\/market\/data\?bedrooms=4$/);
    const status = page.getByRole("status").filter({ hasText: /^(Showing|No homes)/ });
    await expect(status).toHaveText("Showing 1–10 of 15 homes.");

    const price = page.getByRole("columnheader", { name: "Price", exact: true });
    await price.getByRole("button").click();
    await price.getByRole("button").click();
    await expect(price).toHaveAttribute("aria-sort", "descending");
    await expect(page).toHaveURL(/sort=price%2Cdesc/);
    await expect(page.getByRole("row").nth(1)).toContainText("$410,000");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(status).toHaveText("Showing 11–15 of 15 homes.");

    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "CSV, for a spreadsheet" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^property-market-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (await readFile(await download.path(), "utf8")).trim().split("\n");
    expect(lines).toHaveLength(16);
    expect(lines[1]).toMatch(/,410000,/);

    await page.getByLabel("Search these homes").fill("2010");
    await expect(status).toHaveText(/^Showing 1–\d+ of \d+ homes? matching “2010”\.$/);
    await expectNoAxeViolations(page);
  });

  test("reloading the page reuses the portal's data cache instead of calling market-api again", async ({ request }) => {
    const calls = async () => {
      const response = await request.get(
        "/market-api/actuator/metrics/http.server.requests?tag=uri:/api/v1/market/filter-options",
      );
      const { measurements } = (await response.json()) as { measurements: { statistic: string; value: number }[] };
      return measurements.find((m) => m.statistic === "COUNT")!.value;
    };

    // This load fills the cache or, if it has expired, refreshes it in the background: let that finish.
    await request.get("/market/data");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const before = await calls();
    for (let i = 0; i < 3; i++) {
      expect((await request.get("/market/data")).status()).toBe(200);
    }
    expect(await calls()).toBe(before);
  });

  test("the export Route Handler streams the PDF and refuses unknown formats", async ({ request }) => {
    const pdf = await request.get("/api/market/export/pdf?bedrooms=2&sort=price,desc");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["content-disposition"]).toMatch(/attachment; filename="property-market-.+\.pdf"/);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    const unknown = await request.get("/api/market/export/xlsx");
    expect(unknown.status()).toBe(404);
  });

  test("fits a phone: the table scrolls inside its box", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/market/data");
    await expect(page.getByRole("button", { name: "Show filters" })).toHaveAttribute("aria-expanded", "false");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const table = page.locator("[data-slot=table-container]");
    expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
});

test.describe("what-if", () => {
  test("prices a change with the other features held constant, and explains it", async ({ page }) => {
    await page.goto("/market/what-if");
    const result = page.getByRole("region", { name: "Predicted price" });
    await expect(result).toContainText("No change yet");

    const area = page.getByRole("slider", { name: "Living area" });
    await area.focus();
    for (let i = 0; i < 3; i++) {
      await area.press("PageUp");
    }
    await expect(result).toContainText(/[−+]\$[\d,]+ \([−+][\d.]+%\)/);
    await expect(result).toContainText("Holding the other features constant.");
    await expect(result.getByText("How the change adds up")).toBeVisible();
    await expect(result.getByText("Treat this price with caution")).toBeVisible();
    // The brief's plain least squares prices more living area lower, and says why.
    await expect(result).toContainText("Why can more living area lower the price?");
    await expect(page.getByRole("figure", { name: /^Price across/ })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await page.getByLabel("Start from").selectOption("home-7");
    await expect(page).toHaveURL(/baseline=home-7/);
    await expect(result).toContainText("This home actually sold for $410,000.");
    await expect(result).toContainText("No change yet");
  });

  test("the Route Handler checks bodies against the model's limits", async ({ request }) => {
    const baseline = {
      square_footage: 1550,
      bedrooms: 3,
      bathrooms: 2.3,
      year_built: 1997,
      lot_size: 6800,
      distance_to_city_center: 4.1,
      school_rating: 7.6,
    };
    const response = await request.post("/api/market/what-if", { data: { baseline, changes: {} } });
    expect(response.status()).toBe(400);
    const problem = (await response.json()) as { errors: { field: string }[] };
    expect(problem.errors.map((e) => e.field)).toEqual(["baseline.bathrooms"]);
  });

  test("the Ridge set adds the sensitivity line", async ({ page }) => {
    await page.goto(`${RIDGE_URL}/market/what-if?feature=school_rating`);
    const figure = page.getByRole("figure", { name: "Price across school rating" });
    await expect(figure).toContainText(/takes the price from \$[\d,]+ to \$[\d,]+/);
    await expect(page.getByRole("region", { name: "Predicted price" })).toContainText(/Model ridge-\d{4}\./);
    await expectNoAxeViolations(page);
  });
});
