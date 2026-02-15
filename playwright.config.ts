import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm --filter @graph-ai-tutor/api dev",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: true,
      env: { DATABASE_URL: "", NODE_ENV: "test" }
    },
    {
      command: "pnpm --filter @graph-ai-tutor/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: true
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
