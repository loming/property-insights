import { expect, type Locator, type Page, test } from "@playwright/test";

import { deleteTaggedEstimates, saveEstimate } from "./support";

/**
 * Both apps with the keyboard alone (WCAG 1.4.11, 2.1.1, 2.1.2, 2.4.3, 2.4.7 and 2.4.11): every step is a key
 * press, and each checks where focus lands. Every stop on the way must show a focus indicator with 3:1 contrast
 * and sit on screen, not behind the sticky header or the compare tray.
 */

const RUN = `e2e-kbd-${Date.now().toString(36)}`;

test.afterAll(async ({ request }) => {
  await deleteTaggedEstimates(request, RUN);
});

/** Runs in the page: whether focus has reached `target`, and what's wrong with where it is, if anything. */
function inspectFocus(target: Element) {
  const el = document.activeElement as HTMLElement | null;
  // Past the last stop, focus leaves the page for the browser's own controls, then comes back round.
  // Containers that take focus from script (the main landmark, a table) aren't stops of their own.
  if (!el || el.tabIndex < 0) {
    return { arrived: false, problem: null, isStop: false };
  }
  const describe = (node: Element) => node.outerHTML.slice(0, 80);
  const style = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const onTop = document.elementFromPoint(
    box.left + box.width / 2,
    Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1),
  );
  const problem =
    (style.outlineStyle === "none" || parseFloat(style.outlineWidth) === 0) && style.boxShadow === "none"
      ? `no focus indicator on ${describe(el)}`
      : box.bottom <= 0 || box.top >= innerHeight
        ? `off screen: ${describe(el)}`
        : onTop && !el.contains(onTop) && !onTop.contains(el)
          ? `${describe(el)} is covered by ${describe(onTop)}`
          : null;
  return { arrived: el === target, problem, isStop: true };
}

/**
 * Runs in the page: the focused element's name, and how its outline or ring contrasts with what's behind it.
 * Axe doesn't measure this. Transitions are finished first, or a ring fading in reads fainter than it ends up.
 */
function focusContrast() {
  const el = document.activeElement as HTMLElement;
  for (const animation of el.getAnimations()) {
    if (animation instanceof CSSTransition) {
      animation.finish();
    }
  }
  const style = getComputedStyle(el);
  const colours = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 ? [style.outlineColor] : [];
  for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
    const colour = shadow.match(/(?:rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/)?.[0];
    // A shadow with no spread is a drop shadow, not a ring.
    if (colour && parseFloat(shadow.replace(colour, "").trim().split(/\s+/)[3] ?? "0") > 0) {
      colours.push(colour);
    }
  }
  let behind = el.parentElement;
  while (behind && getComputedStyle(behind).backgroundColor === "rgba(0, 0, 0, 0)") {
    behind = behind.parentElement;
  }
  const backdrop = behind ? getComputedStyle(behind).backgroundColor : "#fff";
  const canvas = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const luminance = (...layers: string[]) => {
    for (const layer of layers) {
      ctx.fillStyle = layer;
      ctx.fillRect(0, 0, 1, 1);
    }
    const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) =>
      v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (colour: string) => {
    const [high, low] = [luminance("#fff", backdrop, colour), luminance("#fff", backdrop)].sort((a, b) => b - a);
    return (high! + 0.05) / (low! + 0.05);
  };
  return { name: el.outerHTML.slice(0, 80), contrast: Math.max(0, ...colours.map(ratio)) };
}

async function expectFocusContrast(page: Page) {
  const { name, contrast } = await page.evaluate(focusContrast);
  expect(contrast, `the focus indicator's contrast on ${name}`).toBeGreaterThanOrEqual(3);
}

/** Presses Tab (or Shift+Tab) until `target` has focus, checking every stop on the way. */
async function tabTo(page: Page, target: Locator, { backwards = false } = {}) {
  await expect(target).toBeVisible();
  const handle = await target.elementHandle();
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
    const { arrived, problem, isStop } = await page.evaluate(inspectFocus, handle!);
    expect(problem).toBeNull();
    if (isStop) {
      await expectFocusContrast(page);
    }
    if (arrived) {
      return;
    }
  }
  throw new Error(`Tab never reached ${target}`);
}

test.describe("keyboard only", () => {
  test("every page: Tab comes back round, and every stop can be seen", async ({ page }) => {
    test.setTimeout(90_000);
    for (const path of ["/", "/estimator", "/estimator/history", "/estimator/compare", "/market", "/market/data", "/market/what-if"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await tabTo(page, skip);
      await tabTo(page, skip);
    }
  });

  test("estimate: Enter submits, an error takes focus, and the result goes to the comparison", async ({ page }) => {
    const label = `${RUN} form`;
    await page.goto("/estimator");
    const labelField = page.getByLabel(/^Label/);
    await expect(labelField).toBeEditable();
    await tabTo(page, labelField);
    await page.keyboard.type(label);
    await page.keyboard.press("Tab");
    const area = page.getByLabel(/^Living area/);
    await expect(area).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "One field needs attention" })).toBeVisible();
    await expect(area).toBeFocused();
    await expectFocusContrast(page);

    await page.keyboard.type("1550");
    await page.keyboard.press("Enter");
    const result = page.getByRole("region", { name: label });
    await expect(result.getByText(/^\$\d{3},\d{3}$/).first()).toBeVisible();
    const compare = result.getByRole("button", { name: `Compare ${label}` });
    await tabTo(page, compare);
    await page.keyboard.press("Space");
    await expect(compare).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("complementary", { name: "Comparison tray" })).toContainText("Comparing 1 of 4");
  });

  test("history: delete asks first, Escape keeps the estimate, and focus stays in the table", async ({
    page,
    request,
  }) => {
    const title = `${RUN} delete ${test.info().repeatEachIndex}`;
    await saveEstimate(request, title);
    await page.goto("/estimator/history");
    const del = page.getByRole("button", { name: `Delete ${title}` });
    await tabTo(page, del);
    await page.keyboard.press("Enter");
    const confirm = page.getByRole("group", { name: `Delete ${title}?` });
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(del).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await expect(confirm.getByRole("button", { name: "Delete", exact: true })).toBeFocused();
    await expectFocusContrast(page);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    await expect(page.getByRole("table")).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: `Deleted ${title}.` })).toHaveCount(1);
  });

  test("compare tray: nothing hides behind it, and Clear keeps focus on the page", async ({ page, request }) => {
    // A short window, so the history runs on under the tray. Few estimates: other specs save theirs at the
    // same time, and all of them have to stay on the history's first page of ten.
    await page.setViewportSize({ width: 1280, height: 420 });
    const titles = [1, 2, 3].map((n) => `${RUN} tray ${test.info().repeatEachIndex}.${n}`);
    for (const title of titles) {
      await saveEstimate(request, title);
    }
    await page.goto("/estimator/history");
    // Newest first: pick the top two, then tab down to the third with the tray showing.
    for (const title of [titles[2], titles[1]]) {
      const compare = page.getByRole("button", { name: `Compare ${title}` });
      await tabTo(page, compare);
      await page.keyboard.press("Space");
      await expect(compare).toHaveAttribute("aria-pressed", "true");
    }
    const tray = page.getByRole("complementary", { name: "Comparison tray" });
    await tabTo(page, page.getByRole("button", { name: `Delete ${titles[0]}` }));

    await tabTo(page, tray.getByRole("link", { name: "Compare", exact: true }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/estimator\/compare\?ids=/);
    await expect(page.getByRole("table", { name: /The estimates side by side/ })).toContainText(titles[2]!);

    await tabTo(page, tray.getByRole("button", { name: "Clear" }), { backwards: true });
    await page.keyboard.press("Enter");
    await expect(tray).toHaveCount(0);
    await expect(page.locator("#main")).toBeFocused();
  });

  test("market dashboard: filters and a chart's table", async ({ page }) => {
    await page.goto("/market");
    const threeBed = page.getByRole("checkbox", { name: "3 bed" });
    await tabTo(page, threeBed);
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/bedrooms=3/);
    await expect(threeBed).toBeChecked();
    await expect(threeBed).toBeFocused();

    const lowestPrice = page.getByRole("slider", { name: "Lowest price" });
    await tabTo(page, lowestPrice);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/min_price=/);
    await expect(lowestPrice).toBeFocused();

    await tabTo(page, page.getByRole("button", { name: "Show as table" }).first());
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Show chart" })).toBeFocused();
  });

  test("market data: sorting, paging and the export menu", async ({ page }) => {
    await page.goto("/market/data");
    const price = page.getByRole("button", { name: "Price", exact: true });
    await tabTo(page, price);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/sort=price/);
    await expect(page.getByRole("columnheader", { name: "Price", exact: true })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(price).toBeFocused();

    const next = page.getByRole("button", { name: "Next" });
    await tabTo(page, next);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: /^Showing 11–20 of 50 homes/ })).toHaveCount(1);
    await expect(next).toBeFocused();

    const exportButton = page.getByRole("button", { name: "Export" });
    await tabTo(page, exportButton, { backwards: true });
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: /CSV/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: /PDF/ })).toBeFocused();
    await expectFocusContrast(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(exportButton).toBeFocused();
  });

  test("what-if: the baseline, a slider and both resets leave focus where it can carry on", async ({ page }) => {
    await page.goto("/market/what-if");
    const start = page.getByLabel("Start from");
    await tabTo(page, start);
    const first = await start.inputValue();
    await page.keyboard.press("ArrowDown");
    await expect(start).not.toHaveValue(first);
    await expect(page).toHaveURL(/baseline=/);

    const area = page.getByRole("slider", { name: "Living area" });
    await tabTo(page, area);
    const baseline = (await area.getAttribute("aria-valuetext"))!;
    await page.keyboard.press("ArrowRight");
    await expect(area).not.toHaveAttribute("aria-valuetext", baseline);
    await expect(page.getByRole("status").filter({ hasText: /^Predicted \$/ })).toHaveCount(1);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Reset living area" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(area).toBeFocused();
    await expect(area).toHaveAttribute("aria-valuetext", baseline);

    await page.keyboard.press("ArrowRight");
    const resetAll = page.getByRole("button", { name: "Reset all" });
    await tabTo(page, resetAll, { backwards: true });
    await page.keyboard.press("Enter");
    await expect(resetAll).toBeDisabled();
    await expect(area).toBeFocused();
  });
});
