import { expect, test } from "@playwright/test";

/**
 * P-0: each app keeps working when the other app's backend is down. Run with E2E_DOWN=estimator after
 * `docker compose stop estimator-api && docker compose restart portal` (the restart clears Next's data
 * cache, which would otherwise keep serving), or E2E_DOWN=market likewise.
 */
const down = process.env.E2E_DOWN;

test.describe("one backend down", () => {
  test.skip(!down, "set E2E_DOWN=estimator or E2E_DOWN=market with that backend stopped");

  test("its app shows its own error state; the other app and the shell keep working", async ({ page }) => {
    const [broken, working] = down === "estimator" ? ["/estimator", "/market"] : ["/market", "/estimator"];
    const message = down === "estimator" ? "The estimator isn't available right now" : "The market analysis isn't available right now";

    await page.goto(broken);
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Applications" })).toBeVisible();

    await page.getByRole("navigation", { name: "Applications" }).getByRole("link", { name: down === "estimator" ? "Market" : "Estimator" }).click();
    await expect(page).toHaveURL(new RegExp(`${working}$`));
    await expect(page.getByRole("alert").filter({ hasText: "isn't available" })).toHaveCount(0);

    await page.goto("/");
    const status = page.getByRole("region", { name: "Service status" });
    await expect(status.getByText("Not responding")).toBeVisible();
  });
});
