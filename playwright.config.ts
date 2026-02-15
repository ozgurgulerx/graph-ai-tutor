import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The suite shares a single in-memory API database, so parallel e2e is flaky.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command:
        "node --import ./apps/api/node_modules/tsx/dist/loader.mjs ./apps/api/src/index.ts",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: true,
      env: { DATABASE_URL: "", NODE_ENV: "test", GRAPH_AI_TUTOR_VAULT_DIR: "data/vault-e2e" }
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
