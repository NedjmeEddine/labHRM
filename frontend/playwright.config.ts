import fs from "node:fs"
import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8002"
const systemChromium = fs.existsSync("/usr/bin/chromium")
  ? "/usr/bin/chromium"
  : undefined

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "blob" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    acceptDownloads: true,
    launchOptions: systemChromium
      ? { executablePath: systemChromium }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bash tests/e2e-server.sh",
        url: `${baseURL}/api/v1/utils/health-check/`,
        reuseExistingServer: false,
        timeout: 30_000,
      },
})
