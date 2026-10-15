import { defineConfig, devices } from "@playwright/test";

// Browser tests against `npm run dev` (started automatically if it isn't running) and local Supabase.
// Uses Playwright's bundled Chromium (`npx playwright install chromium`), or an installed browser
// via PLAYWRIGHT_CHANNEL, e.g. PLAYWRIGHT_CHANNEL=msedge or chrome.
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database and one dev server.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "uk-UA",
    timezoneId: "Europe/Kyiv",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", testMatch: /public\.spec/, use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
