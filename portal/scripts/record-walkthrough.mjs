// Records the silent, captioned walkthrough of docs/demo-script.md: the demo's backup video. From
// portal/, with both sets running behind the public hostnames (or BRIEF and RIDGE set to the local
// addresses), and VIDEO_DIR naming the folder for the .webm:
//
//   VIDEO_DIR=../walkthrough node scripts/record-walkthrough.mjs
//
// RESILIENCE=1 also stops ml-api for about a minute and starts it again (the demo's step 6), so leave it
// off while others use the site. FAST=1 shortens every pause, to check the script itself. Estimates it
// saves are labelled with a run tag and deleted at the end.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BRIEF = process.env.BRIEF ?? "https://hsbc.loming.com";
const RIDGE = process.env.RIDGE ?? "https://hsbc-ridge.loming.com";
const REPO = fileURLToPath(new URL("../..", import.meta.url));
const FAST = process.env.FAST === "1";
const RUN = `walkthrough-${Date.now().toString(36)}`;
const size = { width: 1280, height: 800 };

const pause = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 300) : ms));
const log = (step) => console.log(`${new Date().toISOString().slice(11, 19)} ${step}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  ...(process.env.VIDEO_DIR ? { recordVideo: { dir: process.env.VIDEO_DIR, size } } : {}),
});
// A caption bar and a pointer that follows the mouse, on every page.
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById("wt-caption")) return;
    const bar = document.createElement("div");
    bar.id = "wt-caption";
    bar.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:1100px;z-index:2147483647;" +
      "background:rgba(17,24,39,.92);color:#fff;font:500 17px/1.4 system-ui,sans-serif;padding:10px 18px;" +
      "border-radius:10px;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.25)";
    bar.textContent = sessionStorage.getItem("wt-caption") ?? "";
    bar.hidden = !bar.textContent;
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
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);

async function caption(text) {
  log(text);
  await page.evaluate((t) => {
    sessionStorage.setItem("wt-caption", t);
    const bar = document.getElementById("wt-caption");
    if (bar) {
      bar.textContent = t;
      bar.hidden = !t;
    }
  }, text);
}
async function go(url, text) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
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

try {
  // 1-2. Context
  await go(BRIEF, "Property Insights: Task 1's model API and two Task 2 apps, in two sets. This is the brief set: plain linear regression, as asked.");
  await pause(1500);

  // 3. Task 1 in Swagger
  await go(`${BRIEF}/ml-api/docs`, "Task 1, ml-api: FastAPI and scikit-learn, live through Swagger UI behind the gateway's /ml-api/ prefix.");
  await swagger("/health", "get", { pauseAfter: 2000 });
  await caption("GET /model-info: coefficients in raw units, cross-validated metrics against a predict-the-mean baseline, and notes on reading them.");
  await swagger("/model-info", "get", { pauseAfter: 6000 });
  await caption("POST /predict with the 4,100 sq ft example: plain least squares prices it at $0 or less, so the API answers 422 rather than clamping.");
  await swagger("/predict", "post", { example: "4,100", pauseAfter: 4500 });
  await caption("POST /predict/batch with the 10 rows of the provided test file: predictions in input order, with warnings on rows 6 and 8.");
  await swagger("/predict/batch", "post", { pauseAfter: 4500 });
  await go(`${RIDGE}/ml-api/docs`, "The Ridge set's ml-api: the same code trained as Ridge, every size and quality coefficient pointing the expected way.");
  await swagger("/model-info", "get", { pauseAfter: 5000 });

  // 4. App 1
  await go(`${BRIEF}/estimator`, "App 1, the Property Value Estimator: a form for the seven model inputs, starting from a typical home.");
  const area = page.getByLabel(/^Living area/);
  await page.getByLabel(/^Label/).click();
  await page.keyboard.type(`${RUN} Elm St`, { delay: 45 });
  await area.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.getByLabel(/^Bathrooms/).fill("2.3");
  await caption("Invalid input, submitted with Enter: an error summary links to each field, and focus moves to the first.");
  await page.keyboard.press("Enter");
  await pause(4000);
  await area.fill("1550");
  await page.getByLabel(/^Bathrooms/).fill("2");
  await caption("Fixed and submitted: the estimate, the inputs as a table, and where the price sits among the 50 sales.");
  await page.keyboard.press("Enter");
  const result = page.getByRole("region", { name: `${RUN} Elm St` });
  await result.getByText(/^\$\d{3},\d{3}$/).first().waitFor();
  await scrollTo(result.getByRole("figure").first());
  await pause(4000);
  await result.getByRole("button", { name: /^Compare / }).click();
  await caption("Compare puts it in the tray; the history keeps every estimate, newest first.");
  await pause(2000);
  await page.getByRole("navigation", { name: /sections/ }).getByRole("link", { name: "History" }).click();
  await page.waitForURL(/history/);
  await pause(3000);
  const tray = page.getByRole("complementary", { name: "Comparison tray" });
  await tray.waitFor();
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

  // 5. App 2
  await go(`${BRIEF}/market`, "App 2, the Property Market Analysis (Spring Boot backend): every widget streams in on its own.");
  await page.getByRole("checkbox", { name: "3 bed" }).click();
  await caption("Filters live in the URL under the names market-api takes, so a link shares the view, and the server applies them.");
  await page.waitForURL(/bedrooms=3/);
  await pause(3000);
  await page.getByLabel("Split by").selectOption({ label: "Decade built" });
  await scrollTo(page.getByLabel("Split by"));
  await pause(3000);
  await page.mouse.wheel(0, 900);
  await pause(3000);
  await page.getByRole("navigation", { name: /sections/ }).getByRole("link", { name: "Data" }).click();
  await page.waitForURL(/market\/data/);
  await caption("The table keeps the filters: sortable headers, a search box, pages, and CSV or PDF export of what's filtered.");
  await pause(2500);
  await page.getByRole("button", { name: /Price per sq ft/ }).click();
  await pause(2000);
  await page.getByRole("button", { name: "Export" }).click();
  await pause(1500);
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
  await caption("Under plain least squares, more living area lowers the price: the page says why, and warns when the home leaves the data.");
  const living = page.getByRole("slider", { name: "Living area" });
  await living.click();
  await page.keyboard.press("End");
  await pause(2500);
  await scrollTo(page.getByText("Treat this price with caution"));
  await pause(5000);
  await go(`${RIDGE}/market/what-if?baseline=typical-3`, "The Ridge set: more living area raises the price, and a line shows the price across one feature's range.");
  await page.getByRole("slider", { name: "Living area" }).click();
  await page.keyboard.press("End");
  await pause(2000);
  await scrollTo(page.getByRole("figure").last());
  await pause(5000);
  await go(`${BRIEF}/market-api/swagger-ui.html`, "market-api's own Swagger UI, behind the /market-api/ prefix.");
  await pause(2000);

  // 6. Resilience
  if (process.env.RESILIENCE === "1") {
    await caption("Resilience: ml-api is stopped (docker compose stop ml-api)…");
    execSync("docker compose stop ml-api", { cwd: REPO, stdio: "ignore" });
    await go(`${BRIEF}/estimator`, "…the brief set's estimator says the pricing service isn't responding, and saves nothing…");
    await page.getByRole("button", { name: "Estimate price" }).click();
    await page.getByRole("alert").filter({ hasText: "No estimate this time" }).waitFor();
    await pause(3500);
    await go(`${BRIEF}/market`, "…its market dashboard keeps working: it doesn't need the model…");
    await go(`${BRIEF}/market/what-if?baseline=typical-3`, "…what-if still shows the prices market-api has cached (10 minutes)…");
    await page.getByRole("slider", { name: "Year built" }).click();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.getByText("The model isn't answering right now").waitFor();
    await caption("…but a new change needs the model, and the page says it isn't answering. The Ridge set is untouched.");
    await pause(4000);
    execSync("docker compose start ml-api", { cwd: REPO, stdio: "ignore" });
    execSync("docker compose up -d --wait ml-api", { cwd: REPO, stdio: "ignore" });
    await caption("ml-api is back (docker compose start ml-api): Try again, and what-if prices the change.");
    await pause(1500);
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByText("The model isn't answering right now").waitFor({ state: "detached" });
    await pause(3500);
  }

  await go(BRIEF, "Code, tests, decisions and the live demo plan are in the repository's README and docs/.");
  await pause(1500);
} finally {
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
