import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against the running stack, through the gateway, as a visitor sees it. Start it first
 * (`docker compose --profile ridge up -d --wait` from the repo root); E2E_BASE_URL overrides the address.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every worker is the same visitor to the gateway, whose page limit (20 a second, bursts of 60) is per
  // visitor; with more workers, page loads and link prefetches answer 429.
  workers: 3,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8130",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
