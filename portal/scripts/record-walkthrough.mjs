// Records the silent, captioned walkthrough of docs/demo-script.md, the demo's backup video, and checks WCAG 2.2
// AA on camera. From portal/, with both sets running behind the public hostnames (or BRIEF and RIDGE set to the
// local addresses), and VIDEO_DIR naming the folder for the .webm:
//
//   VIDEO_DIR=../walkthrough node scripts/record-walkthrough.mjs
//
// RESILIENCE=1 also stops ml-api for about a minute and starts it again (the demo's step 6), so leave it
// off while others use the site. FAST=1 shortens every pause, to check the script itself. Estimates it
// saves are labelled with a run tag and deleted at the end.
//
// Every WCAG result on screen is measured in this run: axe, with the rules CI runs, on each page and state, and
// scripted checks of what axe can't judge. A failed check is shown and counted rather than stopping the
// recording; the scorecard at the end lists them all, and the script then exits 1. It isn't a full audit: a
// person still has to try the site with a screen reader.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

const BRIEF = process.env.BRIEF ?? "https://hsbc.loming.com";
const RIDGE = process.env.RIDGE ?? "https://hsbc-ridge.loming.com";
const REPO = fileURLToPath(new URL("../..", import.meta.url));
const FAST = process.env.FAST === "1";
const RUN = `walkthrough-${Date.now().toString(36)}`;
const size = { width: 1280, height: 800 };
const PORTAL_PAGES = ["/", "/estimator", "/estimator/history", "/estimator/compare", "/market", "/market/data", "/market/what-if"];
// The rules CI runs (e2e/support.ts).
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// The spacing WCAG 1.4.12 says text must survive.
const TEXT_SPACING =
  "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }";

const pause = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 300) : ms));
const log = (step) => console.log(`${new Date().toISOString().slice(11, 19)} ${step}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  ...(process.env.VIDEO_DIR ? { recordVideo: { dir: process.env.VIDEO_DIR, size } } : {}),
});
// A caption bar, with the latest WCAG result under the caption, and a pointer that follows the mouse, on every page.
await context.addInitScript(() => {
  // The first colour behind an element, and WCAG's contrast ratio between a colour and that backdrop.
  window.wtBackdrop = (el) => {
    let behind = el.parentElement;
    while (behind && getComputedStyle(behind).backgroundColor === "rgba(0, 0, 0, 0)") behind = behind.parentElement;
    return behind ? getComputedStyle(behind).backgroundColor : "#fff";
  };
  window.wtContrast = (colour, backdrop) => {
    const canvas = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const luminance = (...layers) => {
      for (const layer of layers) {
        ctx.fillStyle = layer;
        ctx.fillRect(0, 0, 1, 1);
      }
      const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [high, low] = [luminance("#fff", backdrop, colour), luminance("#fff", backdrop)].sort((a, b) => b - a);
    return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
  };
  // Each part of an element's focus indicator, as its contrast with what's behind it: an outline, a ring, or a
  // border that only changes on focus. Axe can't measure this (1.4.11).
  window.wtIndicator = (el) => {
    for (const animation of el.getAnimations()) if (animation instanceof CSSTransition) animation.finish();
    const style = getComputedStyle(el);
    const parts = [];
    if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) parts.push(style.outlineColor);
    for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
      const colour = shadow.match(/(?:rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/)?.[0];
      if (colour && parseFloat(shadow.replace(colour, "").trim().split(/\s+/)[3]) > 0) parts.push(colour);
    }
    const twin = el.cloneNode(false);
    twin.removeAttribute("id");
    el.after(twin);
    const restingBorder = getComputedStyle(twin).borderTopColor;
    twin.remove();
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopColor !== restingBorder) parts.push(style.borderTopColor);
    const backdrop = window.wtBackdrop(el);
    return parts.map((colour) => window.wtContrast(colour, backdrop));
  };
  const install = () => {
    if (document.getElementById("wt-caption")) return;
    const bar = document.createElement("div");
    bar.id = "wt-caption";
    bar.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:max-content;max-width:min(1100px,calc(100vw - 16px));" +
      "z-index:2147483647;background:rgba(17,24,39,.92);color:#fff;font:500 clamp(13px,1.35vw,17px)/1.4 system-ui,sans-serif;" +
      "padding:10px 18px;border-radius:10px;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.25)";
    const text = document.createElement("div");
    const wcag = document.createElement("div");
    wcag.style.cssText = "font-size:.85em;margin-top:4px";
    bar.append(text, wcag);
    const dot = document.createElement("div");
    dot.id = "wt-pointer";
    dot.style.cssText =
      "position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;z-index:2147483647;" +
      "background:rgba(220,38,38,.55);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px";
    document.body.append(bar, dot);
    addEventListener("mousemove", (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    });
    window.wtBar = (captionText, wcagText) => {
      sessionStorage.setItem("wt-caption", captionText);
      sessionStorage.setItem("wt-wcag", wcagText);
      text.textContent = captionText;
      wcag.textContent = wcagText;
      wcag.style.color = wcagText.startsWith("✗") ? "#fca5a5" : wcagText.startsWith("✓") ? "#86efac" : "#fcd34d";
      wcag.hidden = !wcagText;
      bar.hidden = !captionText && !wcagText;
    };
    window.wtBar(sessionStorage.getItem("wt-caption") ?? "", sessionStorage.getItem("wt-wcag") ?? "");
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);

let captionText = "";
let wcagText = "";
const showBar = () => page.evaluate(([c, w]) => window.wtBar?.(c, w), [captionText, wcagText]);

async function caption(text) {
  log(text);
  captionText = text;
  await showBar();
}
async function wcagLine(text) {
  log(text);
  wcagText = text;
  await showBar();
}

const scans = [];
/** axe on the page as it stands, with the caption bar out of the way: it isn't the app, and would hide what's under it. */
async function scan(where, { thirdParty = false, skipRules = [] } = {}) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const setOverlay = (visibility) =>
    page.evaluate((v) => {
      for (const el of document.querySelectorAll("#wt-caption, #wt-pointer")) el.style.visibility = v;
    }, visibility);
  await setOverlay("hidden");
  // Legacy mode: the default opens a blank page to merge results, and this context records every page it opens.
  // There are no cross-origin frames for it to miss.
  const results = await new AxeBuilder({ page }).setLegacyMode(true).withTags(WCAG_TAGS).disableRules(skipRules).analyze();
  await setOverlay("");
  const violations = results.violations.map((v) => `${v.id} (${v.nodes.length})`);
  // Axe can't read the contrast of text inside an SVG: the 1.4.3 check measures the chart labels instead.
  const undecided = results.incomplete.flatMap((v) => v.nodes.map((node) => ({ rule: v.id, html: node.html })));
  const chartText = undecided.filter((node) => /^<(tspan|text)\b/.test(node.html)).length;
  const others = undecided.filter((node) => !/^<(tspan|text)\b/.test(node.html));
  scans.push({ where, thirdParty, violations, chartText, others, passes: results.passes });
  const name = thirdParty ? `${where} (third-party Swagger UI, not the portal)` : where;
  const left = others.length ? `, ${others.length} for a person to check` : "";
  await wcagLine(
    violations.length
      ? `${thirdParty ? "!" : "✗"} axe, ${name}: ${violations.length} rules fail: ${results.violations.map((v) => v.id).join(", ")}`
      : `✓ axe, ${name}: 0 violations, ${results.passes.length} rules passed${left}`,
  );
  if (violations.length) log(`  axe failures, ${where}: ${violations.join(", ")}`);
  if (!thirdParty) for (const node of others) log(`  axe undecided, ${where}: ${node.rule}: ${node.html.slice(0, 100)}`);
}

const checks = [];
/** One scripted check: it passes with what `run` returns, and fails with what `run` throws. Either way, the run goes on. */
async function check(sc, name, run) {
  let status = "pass";
  let detail;
  try {
    detail = await run();
  } catch (error) {
    status = "fail";
    detail = String(error.message).replace(/\u001b\[\d+m/g, "").split("\n")[0];
  }
  checks.push({ sc, name, status, detail });
  await wcagLine(`${status === "pass" ? "✓" : "✗"} ${sc} ${name}: ${detail}`);
  await pause(2800);
}

/**
 * Runs in the page: the element with focus, and whether it can be seen: an indicator, on screen and not covered, as
 * in e2e/keyboard.spec.ts, and the contrast of the indicator's strongest part.
 */
function focusStop(target) {
  const el = document.activeElement;
  // Past the last stop, focus leaves the page for the browser's own controls, then comes back round.
  // Containers that take focus from script (the main landmark, a table) aren't stops of their own.
  if (!el || el === document.body || el.tabIndex < 0) return null;
  window.wtFirstStop ??= el;
  (window.wtReached ??= new Set()).add(el);
  const ratios = window.wtIndicator(el);

  const box = el.getBoundingClientRect();
  const onTop = document.elementFromPoint(
    box.left + box.width / 2,
    Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1),
  );
  const covered = onTop !== null && !el.contains(onTop) && !onTop.contains(el);
  const name = el.getAttribute("aria-label") || el.labels?.[0]?.innerText || el.innerText || el.tagName;
  return {
    name: name.replace(/\s+/g, " ").trim().slice(0, 40),
    arrived: el === target,
    first: el === window.wtFirstStop,
    hasIndicator: ratios.length > 0,
    contrast: Math.max(0, ...ratios),
    hidden: box.bottom <= 0 || box.top >= innerHeight || covered,
    top: box.top + scrollY,
    left: box.left,
  };
}
/** Runs in the page: visible controls that Tab hasn't reached. */
function outOfReach() {
  const controls = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [role=slider], [role=checkbox]";
  return [...document.querySelectorAll(controls)]
    .filter((el) => el.checkVisibility() && !window.wtReached?.has(el) && !el.closest("[aria-hidden=true], #wt-caption"))
    .map((el) => (el.getAttribute("aria-label") || el.innerText || el.tagName).slice(0, 40));
}

const stops = [];
/** Presses Tab (or Shift+Tab) once, and keeps where focus landed. */
async function tab({ backwards = false, target, delay = 200 } = {}) {
  await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
  const stop = await page.evaluate(focusStop, target);
  if (stop) stops.push({ ...stop, url: new URL(page.url()).pathname });
  await pause(delay);
  return stop;
}
/** Presses Tab (or Shift+Tab) until `target` has focus. */
async function tabTo(target, { backwards = false } = {}) {
  await target.waitFor();
  const handle = await target.elementHandle();
  for (let presses = 0; presses < 80; presses++) {
    const stop = await tab({ backwards, target: handle });
    if (stop?.arrived) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

/** Runs in the page: how far it scrolls sideways, and any text that something clips. */
function textProblems() {
  const cut = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!walker.currentNode.textContent.trim() || el.closest(".sr-only, [aria-hidden=true], script, style, #wt-caption")) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    const rects = [...range.getClientRects()];
    for (let box = el; box && box !== document.body && rects.length; box = box.parentElement) {
      const boxStyle = getComputedStyle(box);
      const x = /hidden|clip/.test(boxStyle.overflowX);
      const y = /hidden|clip/.test(boxStyle.overflowY);
      if (!x && !y) continue;
      const edge = box.getBoundingClientRect();
      const clipped = rects.some(
        (r) => (x && (r.left < edge.left - 1 || r.right > edge.right + 1)) || (y && (r.top < edge.top - 1 || r.bottom > edge.bottom + 1)),
      );
      if (clipped) {
        cut.push(el.textContent.trim().slice(0, 40));
        break;
      }
    }
  }
  return { sideways: document.documentElement.scrollWidth - innerWidth, cut };
}
/** Text a page already cuts off at its normal size, by design (a long label in the compare tray), by path. */
const cutAtNormalSize = {};
/** Visits every page at one window size, or with extra CSS, and throws if anything newly overflows. The size stays, for the result on screen. */
async function checkLayout(what, { viewport = size, css } = {}) {
  await page.setViewportSize(viewport);
  const problems = [];
  for (const path of PORTAL_PAGES) {
    await page.goto(`${BRIEF}${path}`);
    await page.waitForLoadState("networkidle");
    if (css) await page.addStyleTag({ content: css });
    await caption(`${what}: ${path}`);
    const { sideways, cut } = await page.evaluate(textProblems);
    const newlyCut = cut.filter((text) => !cutAtNormalSize[path]?.includes(text));
    if (sideways > 0) problems.push(`${path} scrolls ${sideways} px sideways`);
    if (newlyCut.length) problems.push(`${path} cuts off "${newlyCut[0]}"`);
    await pause(1100);
  }
  if (problems.length) throw new Error(problems.join("; "));
  return `${PORTAL_PAGES.length} pages: no sideways scrolling, no text cut off`;
}

/** Keyframe animations seen on a tour of the market pages, as the visitor's motion setting has it. */
async function animationsSeen(reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.goto(`${BRIEF}/market`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    window.wtSeen = new Set();
    const sample = () => {
      for (const animation of document.getAnimations()) {
        if (animation instanceof CSSAnimation && animation.playState === "running" && animation.effect.getComputedTiming().duration > 0) {
          window.wtSeen.add(`${animation.animationName}${animation.effect.pseudoElement ?? ""}`);
        }
      }
      requestAnimationFrame(sample);
    };
    sample();
  });
  const sections = page.getByRole("navigation", { name: /sections/ });
  await sections.getByRole("link", { name: "Data" }).click();
  await page.waitForURL(/market\/data/);
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menu").waitFor();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await sections.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("checkbox", { name: "3 bed" }).click();
  await page.waitForURL(/bedrooms=3/);
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => [...window.wtSeen]);
  await page.emulateMedia({ reducedMotion: null });
  return seen;
}

/** The last frame: every result of this run, on one screen. */
async function showScorecard() {
  const portal = scans.filter((s) => !s.thirdParty);
  const violated = portal.flatMap((s) => s.violations.map((v) => `${v} on ${s.where}`));
  const rows = [
    {
      sc: "axe",
      name: "Automated rules",
      status: violated.length ? "fail" : "pass",
      detail: `${portal.length} scans of portal pages and states: ${violated.length ? violated.join(", ") : "0 violations"}`,
    },
    ...[...checks].sort((a, b) => a.sc.localeCompare(b.sc, undefined, { numeric: true })),
  ];
  const criteria = [...new Set(portal.flatMap((s) => s.passes.flatMap((rule) => rule.tags)))]
    .flatMap((tag) => tag.match(/^wcag(\d)(\d)(\d+)$/)?.slice(1).join(".") ?? [])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const chartText = portal.reduce((sum, s) => sum + s.chartText, 0);
  const others = portal.flatMap((s) => s.others.map((node) => node.rule));
  const swagger = [...new Set(scans.filter((s) => s.thirdParty).flatMap((s) => s.violations.map((v) => v.split(" ")[0])))];
  const notes = [
    `axe rules passed for: ${criteria.join(", ")}`,
    ...(chartText ? [`axe can't read the contrast of text in a chart (${chartText} labels across the scans): the 1.4.3 row measures it instead`] : []),
    ...(others.length ? [`axe couldn't decide ${others.length} other items, for a person to check: ${[...new Set(others)].join(", ")} (the run's log lists them)`] : []),
    ...(swagger.length ? [`Swagger UI (third-party API docs, not the portal) fails axe: ${swagger.join(", ")}`] : []),
    "Not a full audit: whether wording and alternatives make sense, and a screen-reader pass (NVDA or Narrator), need a person.",
  ];
  const passed = rows.filter((row) => row.status === "pass").length;
  await page.evaluate(
    ({ rows, notes, heading }) => {
      document.getElementById("wt-caption").hidden = true;
      const card = document.createElement("div");
      card.id = "wt-scorecard";
      card.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:#0f172a;color:#f8fafc;font:13px/1.3 system-ui,sans-serif;padding:16px 32px;box-sizing:border-box";
      const title = document.createElement("div");
      title.textContent = heading;
      title.style.cssText = "font-size:20px;font-weight:600;margin-bottom:10px";
      const table = document.createElement("table");
      table.style.cssText = "width:100%;border-collapse:collapse";
      for (const row of rows) {
        const tr = table.insertRow();
        tr.style.borderTop = "1px solid #334155";
        const cells = [row.status === "pass" ? "✓" : "✗", row.sc, row.name, row.detail];
        cells.forEach((value, i) => {
          const td = tr.insertCell();
          td.textContent = value;
          td.style.cssText = `padding:2px 8px;vertical-align:top;${i < 3 ? "white-space:nowrap;" : ""}`;
          if (i === 0) td.style.color = row.status === "pass" ? "#86efac" : "#fca5a5";
          if (row.status !== "pass" && i > 0) td.style.color = "#fca5a5";
        });
      }
      const footer = document.createElement("div");
      footer.style.cssText = "margin-top:10px;font-size:12px;color:#cbd5e1";
      for (const note of notes) {
        const line = document.createElement("div");
        line.textContent = note;
        line.style.marginTop = "3px";
        footer.append(line);
      }
      card.append(title, table, footer);
      document.body.append(card);
    },
    { rows, notes, heading: `WCAG 2.2 AA, measured in this run: ${passed} of ${rows.length} passed` },
  );
  for (const row of rows) console.log(`${row.status.toUpperCase()}  ${row.sc} ${row.name}: ${row.detail}`);
  for (const note of notes) console.log(note);
  if (rows.some((row) => row.status !== "pass")) process.exitCode = 1;
  await pause(20000);
}

async function go(url, text, { thirdParty = false } = {}) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await scan(`${url.startsWith(RIDGE) ? "Ridge set " : ""}${new URL(url).pathname}`, { thirdParty });
  await caption(text);
  await pause(2500);
}
async function scrollTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  await pause(600);
}

/** Swagger UI: open an operation, optionally pick an example, run it, and show the response. */
async function swagger(path, method, { example, pauseAfter = 3500 } = {}) {
  const block = page.locator(`.opblock-${method}`).filter({ has: page.locator(".opblock-summary-path", { hasText: new RegExp(`^${path.replace("/", "\\/")}$`) }) });
  await block.locator(".opblock-summary").click();
  await pause(800);
  await block.getByRole("button", { name: "Try it out" }).click();
  await pause(700);
  if (example) {
    const select = block.locator("select").first();
    const labels = await select.locator("option").allTextContents();
    await select.selectOption({ label: labels.find((l) => l.includes(example)) });
    await pause(1200);
  }
  await block.getByRole("button", { name: "Execute" }).click();
  const response = block.locator(".live-responses-table .response-col_description").first();
  await response.waitFor();
  await scrollTo(response);
  await pause(pauseAfter);
  await block.locator(".opblock-summary").click();
  await pause(500);
}

let modelStopped = false;
try {
  // 1-2. Context
  await go(BRIEF, "Property Insights: Task 1's model API and two Task 2 apps, in two sets. This is the brief set: plain linear regression, as asked.");
  await pause(1500);
  await caption("The line under each caption is a WCAG 2.2 AA result, measured live in this run: green passes, red fails. The last screen lists them all.");
  await pause(4500);

  // 3. Task 1 in Swagger
  await go(`${BRIEF}/ml-api/docs`, "Task 1, ml-api: FastAPI and scikit-learn, live through Swagger UI behind the gateway's /ml-api/ prefix.", { thirdParty: true });
  await swagger("/health", "get", { pauseAfter: 2000 });
  await caption("GET /model-info: coefficients in raw units, cross-validated metrics against a predict-the-mean baseline, and notes on reading them.");
  await swagger("/model-info", "get", { pauseAfter: 6000 });
  await caption("POST /predict with the 4,100 sq ft example: plain least squares prices it at $0 or less, so the API answers 422 rather than clamping.");
  await swagger("/predict", "post", { example: "4,100", pauseAfter: 4500 });
  await caption("POST /predict/batch with the 10 rows of the provided test file: predictions in input order, with warnings on rows 6 and 8.");
  await swagger("/predict/batch", "post", { pauseAfter: 4500 });
  await go(`${RIDGE}/ml-api/docs`, "The Ridge set's ml-api: the same code trained as Ridge, every size and quality coefficient pointing the expected way.", { thirdParty: true });
  await swagger("/model-info", "get", { pauseAfter: 5000 });

  // 4. App 1
  await go(`${BRIEF}/estimator`, "App 1, the Property Value Estimator: a form for the seven model inputs, starting from a typical home.");
  const labelField = page.getByLabel(/^Label/);
  const area = page.getByLabel(/^Living area/);
  const bathrooms = page.getByLabel(/^Bathrooms/);
  await expect(labelField).toBeEditable();
  await caption("By keyboard alone from here: Tab through the form, then back up to its first field.");
  await tabTo(labelField);
  await check("2.4.3", "Focus Order", async () => {
    const from = stops.length - 1;
    await tabTo(page.getByRole("button", { name: /^Reset/ }));
    const walked = stops.slice(from);
    const outOfOrder = walked.slice(1).filter((b, i) => !(b.top > walked[i].top + 8 || (b.left > walked[i].left && b.top > walked[i].top - 40)));
    if (outOfOrder.length) throw new Error(`out of reading order: ${outOfOrder.map((stop) => stop.name).join(", ")}`);
    return `${walked.length} stops through the form, top to bottom and left to right`;
  });
  await tabTo(labelField, { backwards: true });
  await page.keyboard.type(`${RUN} Elm St`, { delay: 45 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await tabTo(bathrooms);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("2.3");
  await caption("Invalid input, submitted with Enter: an error summary links to each field, and focus moves to the first.");
  await page.keyboard.press("Enter");
  await check("3.3.1", "Error Identification", async () => {
    const summary = page.getByRole("alert").filter({ hasText: "2 fields need attention" });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveCount(2);
    await expect(area, "focus should move to the first bad field").toBeFocused();
    for (const field of [area, bathrooms]) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    return "a summary links to both bad fields, focus moves to the first, and each is marked invalid";
  });
  await check("3.3.3", "Error Suggestion", async () => {
    await expect(bathrooms).toHaveAccessibleDescription(/Use steps of 0\.5, such as 2 or 2\.5/);
    return 'Bathrooms says how to fix it, and a screen reader hears it: "Use steps of 0.5, such as 2 or 2.5"';
  });
  await scan("the form showing errors");
  await pause(1500);
  await page.keyboard.type("1550");
  await tabTo(bathrooms);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("2");
  await caption("Fixed and submitted: the estimate, the inputs as a table, and where the price sits among the 50 sales.");
  await page.keyboard.press("Enter");
  const result = page.getByRole("region", { name: `${RUN} Elm St` });
  await result.getByText(/^\$\d{3},\d{3}$/).first().waitFor();
  await check("4.1.3", "Status Messages (estimate)", async () => {
    const said = page.locator("p[aria-live=polite]").filter({ hasText: /^Estimated price/ });
    await expect(said).toHaveCount(1);
    return `a new estimate is announced without moving focus: "${await said.textContent()}"`;
  });
  await scrollTo(result.getByRole("figure").first());
  await pause(3000);
  await scan("the estimate's result");
  const compareResult = result.getByRole("button", { name: /^Compare / });
  await tabTo(compareResult);
  await page.keyboard.press("Space");
  await caption("Compare puts it in the tray; the history keeps every estimate, newest first.");
  await pause(2000);
  await page.getByRole("navigation", { name: /sections/ }).getByRole("link", { name: "History" }).click();
  await page.waitForURL(/history/);
  await pause(3000);
  const tray = page.getByRole("complementary", { name: "Comparison tray" });
  await tray.waitFor();
  await scan("the history, with the tray showing");
  let picked = 0;
  for (const button of await page.getByRole("button", { name: /^Compare / }).all()) {
    if (picked < 2 && (await button.getAttribute("aria-pressed")) === "false") {
      await button.click();
      picked++;
      await pause(900);
    }
  }
  const compareLink = tray.getByRole("link", { name: "Compare", exact: true });
  if (await compareLink.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    await compareLink.click();
    await page.waitForURL(/compare\?ids=/);
    await page.waitForLoadState("networkidle");
    await scan("the comparison");
    await caption("Side by side: the highest and lowest value in each row marked, and the prices and features charted.");
    await pause(3500);
    await page.mouse.wheel(0, 650);
    await pause(3000);
  }
  await go(`${RIDGE}/estimator`, "The same home on the Ridge set, which also shows what each feature adds to or takes from the average home's price.");
  await page.getByLabel(/^Label/).fill(`${RUN} Ridge`);
  await page.getByRole("button", { name: "Estimate price" }).click();
  const ridgeResult = page.getByRole("region", { name: `${RUN} Ridge` });
  await scrollTo(ridgeResult.getByRole("figure", { name: "What moves this estimate" }));
  await pause(4500);
  await scan("the Ridge set's estimate");

  // 5. App 2
  await go(`${BRIEF}/market`, "App 2, the Property Market Analysis (Spring Boot backend): every widget streams in on its own.");
  await page.getByRole("checkbox", { name: "3 bed" }).click();
  await caption("Filters live in the URL under the names market-api takes, so a link shares the view, and the server applies them.");
  await page.waitForURL(/bedrooms=3/);
  await check("4.1.3", "Status Messages (filters)", async () => {
    const said = page.getByRole("status").filter({ hasText: /updated\.$/ }).first();
    await expect(said).toBeAttached();
    return `filtered results are announced without moving focus: "${await said.textContent()}"`;
  });
  await page.getByLabel("Split by").selectOption({ label: "Decade built" });
  await scrollTo(page.getByLabel("Split by"));
  await pause(3000);
  await page.mouse.wheel(0, 900);
  await pause(3000);
  await scan("the dashboard, filtered");
  await check("1.4.3", "Contrast (chart labels)", async () => {
    const ratios = await page.locator("svg.recharts-surface text").evaluateAll((labels) =>
      labels.map((label) => window.wtContrast(getComputedStyle(label).fill, window.wtBackdrop(label.closest("svg")))),
    );
    if (ratios.length === 0) throw new Error("no chart labels found");
    const lowest = Math.min(...ratios);
    if (lowest < 4.5) throw new Error(`${ratios.filter((ratio) => ratio < 4.5).length} of ${ratios.length} chart labels are under 4.5:1, the lowest ${lowest}:1`);
    return `all ${ratios.length} chart labels reach 4.5:1, the lowest ${lowest}:1`;
  });
  await caption("Charts: screen readers get a data table in place of each drawing, and anyone can switch to it.");
  await check("1.1.1", "Non-text Content", async () => {
    const charts = await page.getByRole("figure").evaluateAll((figures) =>
      figures.filter((figure) => figure.querySelector("svg.recharts-surface")).map((figure) => ({
        hidden: [...figure.querySelectorAll("svg.recharts-surface")].every((svg) => svg.closest("[aria-hidden=true]")),
        table: figure.querySelector("table") !== null,
      })),
    );
    if (charts.length === 0) throw new Error("no charts found");
    if (charts.some((chart) => !chart.hidden || !chart.table)) throw new Error("a chart has no data table in its place");
    const figure = page.getByRole("figure").filter({ has: page.getByLabel("Split by") });
    await scrollTo(figure);
    await figure.getByRole("button", { name: "Show as table" }).click();
    await expect(figure.getByRole("button", { name: "Show chart" })).toBeFocused();
    await expect(figure.locator("svg.recharts-surface")).toHaveCount(0);
    await pause(2500);
    await figure.getByRole("button", { name: "Show chart" }).click();
    return `${charts.length} charts, each with a data table in its place; the switch keeps focus`;
  });
  await page.getByRole("navigation", { name: /sections/ }).getByRole("link", { name: "Data" }).click();
  await page.waitForURL(/market\/data/);
  await caption("The table keeps the filters: sortable headers, a search box, pages, and CSV or PDF export of what's filtered.");
  await pause(2500);
  await page.getByRole("button", { name: /Price per sq ft/ }).click();
  await check("4.1.2", "Name, Role, Value (table)", async () => {
    await expect(page.getByRole("columnheader", { name: /Price per sq ft/ })).toHaveAttribute("aria-sort", "ascending");
    return "the sorted column tells a screen reader its direction: aria-sort is ascending";
  });
  await scan("the data table, sorted");
  await page.getByRole("button", { name: "Export" }).click();
  await pause(1500);
  // Axe's aria-hidden-focus flags what the menu hides behind it, though focus can't get there: measured here instead.
  await scan("the open export menu", { skipRules: ["aria-hidden-focus"] });
  await check("1.4.11", "Non-text Contrast (menu highlight)", async () => {
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[role=menuitem]:focus")).toHaveCount(1);
    const best = await page.evaluate(() => Math.max(0, ...window.wtIndicator(document.activeElement)));
    if (best < 3) throw new Error(`the highlighted item's focus indicator is only ${best}:1`);
    return `the highlighted item's focus indicator reaches ${best}:1`;
  });
  await check("2.4.3", "Focus Order (open menu)", async () => {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toBeVisible();
    const inMenu = await page.evaluate(() => document.activeElement?.closest("[role=menu]") !== null);
    if (!inMenu) throw new Error("Tab leaves the open menu");
    return "Tab stays in the open menu, so what it hides can't take focus (axe's aria-hidden-focus rule is off for this one scan)";
  });
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /PDF/ }).click();
  log(`downloaded ${(await download).suggestedFilename()}`);
  await pause(2000);

  await go(`${BRIEF}/market/what-if?baseline=typical-3`, "What-if: start from the typical 3-bed home and change one feature at a time, the others held constant.");
  for (const [name, presses] of [["Lot size", 6], ["School rating", 6]]) {
    const slider = page.getByRole("slider", { name });
    await slider.click();
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press("ArrowRight");
      await pause(120);
    }
    await pause(1800);
  }
  const school = page.getByRole("slider", { name: "School rating" });
  await check("4.1.2", "Name, Role, Value (sliders)", async () => {
    const value = await school.getAttribute("aria-valuetext");
    if (!value) throw new Error("the slider doesn't say its value");
    return `each slider has a name and says its value: "School rating, ${value}"`;
  });
  await check("4.1.3", "Status Messages (what-if)", async () => {
    const said = page.getByRole("status").filter({ hasText: /^Predicted \$/ });
    await expect(said).toHaveCount(1);
    return `each new price is announced: "${await said.textContent()}"`;
  });
  await check("2.5.7", "Dragging Movements", async () => {
    const before = await school.getAttribute("aria-valuetext");
    const box = await page.locator("[data-slot=slider]").filter({ has: school }).boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 12 });
    await pause(500);
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await expect(school).not.toHaveAttribute("aria-valuetext", before);
    return `one click on the track moves a slider, no drag needed: ${before} to ${await school.getAttribute("aria-valuetext")}`;
  });
  await caption("Under plain least squares, more living area lowers the price: the page says why, and warns when the home leaves the data.");
  const living = page.getByRole("slider", { name: "Living area" });
  await living.click();
  await page.keyboard.press("End");
  await pause(2500);
  await scrollTo(page.getByText("Treat this price with caution"));
  await pause(4000);
  await scan("the what-if warning");
  await go(`${RIDGE}/market/what-if?baseline=typical-3`, "The Ridge set: more living area raises the price, and a line shows the price across one feature's range.");
  await page.getByRole("slider", { name: "Living area" }).click();
  await page.keyboard.press("End");
  await pause(2000);
  await scrollTo(page.getByRole("figure").last());
  await pause(5000);
  await go(`${BRIEF}/market-api/swagger-ui.html`, "market-api's own Swagger UI, behind the /market-api/ prefix.", { thirdParty: true });
  await pause(2000);

  // 6. Resilience
  if (process.env.RESILIENCE === "1") {
    await caption("Resilience: ml-api is stopped (docker compose stop ml-api)…");
    execSync("docker compose stop ml-api", { cwd: REPO, stdio: "ignore" });
    modelStopped = true;
    await go(`${BRIEF}/estimator`, "…the brief set's estimator says the pricing service isn't responding, and saves nothing…");
    await page.getByRole("button", { name: "Estimate price" }).click();
    await check("4.1.3", "Status Messages (failure)", async () => {
      await expect(page.getByRole("alert").filter({ hasText: "No estimate this time" })).toBeVisible({ timeout: 20_000 });
      return 'the failure is announced as an alert: "No estimate this time"';
    });
    await scan("the estimator with the model down");
    await pause(1000);
    await go(`${BRIEF}/market`, "…its market dashboard keeps working: it doesn't need the model…");
    await go(`${BRIEF}/market/what-if?baseline=typical-3`, "…what-if still shows the prices market-api has cached (10 minutes)…");
    await page.getByRole("slider", { name: "Year built" }).click();
    // market-api caches what-if prices for 10 minutes: a different year each minute, so a re-recording still needs the model.
    for (let i = 0; i <= new Date().getMinutes() % 10; i++) await page.keyboard.press("ArrowLeft");
    await page.getByText("The model isn't answering right now").waitFor();
    await caption("…but a new change needs the model, and the page says it isn't answering. The Ridge set is untouched.");
    await pause(3000);
    await scan("what-if with the model down");
    execSync("docker compose start ml-api", { cwd: REPO, stdio: "ignore" });
    execSync("docker compose up -d --wait ml-api", { cwd: REPO, stdio: "ignore" });
    modelStopped = false;
    await caption("ml-api is back (docker compose start ml-api): Try again, and what-if prices the change.");
    await pause(1500);
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("The model isn't answering right now").waitFor({ state: "detached" });
    await pause(3500);
  }

  // WCAG across the whole site: what axe can't judge
  await go(BRIEF, "Now the whole site, for what axe can't judge. First, the skip link: Tab once, then Enter.");
  await check("2.4.1", "Bypass Blocks", async () => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await pause(1800);
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
    return "the first Tab stop is a skip link, and Enter moves focus to the content";
  });

  const trapped = [];
  const missed = [];
  const titles = [];
  const headings = [];
  const navigation = [];
  const firstStop = stops.length;
  for (const path of PORTAL_PAGES) {
    await page.goto(`${BRIEF}${path}`);
    await page.waitForLoadState("networkidle");
    await scan(path);
    await caption(`Tab all the way round ${path}: every stop must show focus, stay in view, and Tab must get back to the start.`);
    titles.push(await page.title());
    headings.push(await page.locator("h1").count());
    navigation.push((await page.getByRole("navigation", { name: "Applications" }).getByRole("link").allTextContents()).join());
    cutAtNormalSize[path] = (await page.evaluate(textProblems)).cut;
    let round = false;
    for (let presses = 0; presses < 150 && !round; presses++) {
      const stop = await tab({ delay: 45 });
      round = presses > 0 && stop?.first === true;
    }
    if (!round) trapped.push(path);
    missed.push(...(await page.evaluate(outOfReach)).map((name) => `${name} on ${path}`));
  }
  const swept = stops.slice(firstStop);
  for (const [path, cut] of Object.entries(cutAtNormalSize)) if (cut.length) log(`  cut off at normal size on ${path}: ${cut.join(" | ")}`);
  await caption("Tab round all 7 pages: the results.");
  await check("2.1.1", "Keyboard", async () => {
    if (missed.length) throw new Error(`Tab misses ${missed.length} visible controls, such as ${missed[0]}`);
    return `${swept.length} Tab stops on ${PORTAL_PAGES.length} pages, and no visible control is out of reach`;
  });
  await check("2.1.2", "No Keyboard Trap", async () => {
    if (trapped.length) throw new Error(`Tab never got back to the start of ${trapped.join(", ")}`);
    return `Tab gets back to the start of all ${PORTAL_PAGES.length} pages`;
  });
  await check("2.4.7", "Focus Visible", async () => {
    const bare = stops.filter((stop) => !stop.hasIndicator);
    if (bare.length) throw new Error(`${bare.length} of ${stops.length} stops show no indicator, such as ${bare[0].name} on ${bare[0].url}`);
    return `all ${stops.length} stops show a focus indicator`;
  });
  await check("2.4.11", "Focus Not Obscured", async () => {
    const hidden = stops.filter((stop) => stop.hidden);
    if (hidden.length) throw new Error(`${hidden.length} of ${stops.length} stops are off screen or covered, such as ${hidden[0].name} on ${hidden[0].url}`);
    return `none of the ${stops.length} stops is off screen or behind the header or tray`;
  });
  await check("1.4.11", "Non-text Contrast", async () => {
    const faint = stops.filter((stop) => stop.contrast < 3);
    const lowest = Math.min(...stops.map((stop) => stop.contrast));
    const byRatio = [...new Set(faint.sort((a, b) => a.contrast - b.contrast).map((stop) => `${stop.contrast} ${stop.name}`))];
    log(`  focus indicators under 3:1: ${byRatio.join(" | ")}`);
    if (faint.length) throw new Error(`${faint.length} of ${stops.length} focus indicators are under 3:1, the lowest ${lowest}:1`);
    return `all ${stops.length} focus indicators reach 3:1, the lowest ${lowest}:1`;
  });
  await check("2.4.2", "Page Titled", async () => {
    if (new Set(titles).size !== titles.length) throw new Error(`repeated titles: ${titles.join(", ")}`);
    return `${titles.length} pages, ${titles.length} different titles`;
  });
  await check("2.4.6", "Headings and Labels", async () => {
    if (headings.some((count) => count !== 1)) throw new Error(`h1s per page: ${headings.join(", ")}`);
    return `each of the ${headings.length} pages has one main heading`;
  });
  await check("3.2.3", "Consistent Navigation", async () => {
    if (new Set(navigation).size !== 1) throw new Error(`the links differ: ${[...new Set(navigation)].join(" / ")}`);
    return `the same links in the same order on all ${navigation.length} pages`;
  });

  await check("1.4.10", "Reflow", () => checkLayout("1.4.10 at 320 px wide (400% zoom)", { viewport: { width: 320, height: 800 } }));
  await check("1.4.4", "Resize Text", () => checkLayout("1.4.4 at half the window (200% zoom)", { viewport: { width: 640, height: 400 } }));
  await check("1.4.12", "Text Spacing", () => checkLayout("1.4.12 with WCAG's wider text spacing", { css: TEXT_SPACING }));

  await caption("Reduced motion: the same tour of the market pages, with animation allowed and then with the visitor asking for less.");
  await check("2.3.3", "Animation from Interactions (AAA)", async () => {
    const normal = await animationsSeen("no-preference");
    const reduced = await animationsSeen("reduce");
    log(`  animations with no preference: ${normal.join(", ")}`);
    if (normal.length === 0) throw new Error("no animation ran even with motion allowed, so this shows nothing");
    if (reduced.length) throw new Error(`still animated with reduced motion: ${reduced.join(", ")}`);
    return `${normal.length} kinds of animation run normally, and none with reduced motion`;
  });

  await go(BRIEF, "Code, tests, decisions and the live demo plan are in the repository's README and docs/.");
  await pause(1500);
  await showScorecard();
} finally {
  // A run that fails half-way mustn't leave the model stopped.
  if (modelStopped) execSync("docker compose up -d --wait ml-api", { cwd: REPO, stdio: "ignore" });
  // The demo's history is shared: remove what this run saved, in both sets.
  for (const base of [BRIEF, RIDGE]) {
    const { items } = await (await fetch(`${base}/estimator-api/api/v1/estimates?limit=100`)).json();
    for (const { id } of items.filter((item) => item.label?.startsWith(RUN))) {
      await fetch(`${base}/estimator-api/api/v1/estimates/${id}`, { method: "DELETE" });
    }
  }
  const video = page.video();
  await context.close();
  if (video) console.log(`video: ${await video.path()}`);
  await browser.close();
}
