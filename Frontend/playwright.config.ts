import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    headless: true,
    launchOptions: { args: ["--no-sandbox", "--disable-gpu"] },
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
  },
});
