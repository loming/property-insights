import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The Ridge set, through the same gateway: browsers resolve *.localhost to this machine.
export const RIDGE_URL = process.env.E2E_RIDGE_URL ?? "http://ridge.localhost:8130";

/** Fails with the list of WCAG 2.2 AA violations axe finds on the page as it is now. */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}
