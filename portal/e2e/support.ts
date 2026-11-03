import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

// The Ridge set, through the same gateway: browsers resolve *.localhost to this machine.
export const RIDGE_URL = process.env.E2E_RIDGE_URL ?? "http://ridge.localhost:8130";

export const EXAMPLE = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

/** Saves an estimate in the brief set's history and returns its id. */
export async function saveEstimate(request: APIRequestContext, label: string, features = EXAMPLE) {
  const response = await request.post("/estimator-api/api/v1/estimates", { data: { label, features } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return id;
}

/**
 * The history is the live demo's: each spec labels what it saves with a run tag, and deletes every
 * estimate with that tag from both sets afterwards, even when a test failed half-way.
 */
export async function deleteTaggedEstimates(request: APIRequestContext, run: string) {
  for (const base of ["", RIDGE_URL]) {
    const response = await request.get(`${base}/estimator-api/api/v1/estimates?limit=100`);
    const { items } = (await response.json()) as { items: { id: string; label: string | null }[] };
    for (const { id } of items.filter((item) => item.label?.startsWith(`${run} `))) {
      await request.delete(`${base}/estimator-api/api/v1/estimates/${id}`);
    }
  }
}

/**
 * Fails with the list of WCAG 2.2 AA violations axe finds on the page. It waits for running transitions
 * first (a button fading in from disabled is half its final contrast mid-way); endless animations, such
 * as a spinner, are left alone.
 */
export async function expectNoAxeViolations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}
