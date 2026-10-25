import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: "09-external-bookings.spec.ts", workers: 1, timeout: 60000,
  expect: { timeout: 15000 }, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3013", channel: "chrome", headless: true, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
});
