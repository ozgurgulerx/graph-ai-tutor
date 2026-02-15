import { defineConfig, devices } from "@playwright/test";

import { E2E_API_BASE_URL, E2E_API_PORT, E2E_WEB_BASE_URL, E2E_WEB_PORT } from "./e2e/e2e-ports";

export default defineConfig({
  testDir: "./e2e",
  // The suite shares a single in-memory API database, so parallel e2e is flaky.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: E2E_WEB_BASE_URL,
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command:
        "node --import ./apps/api/node_modules/tsx/dist/loader.mjs ./apps/api/src/index.ts",
      url: `${E2E_API_BASE_URL}/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "",
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(E2E_API_PORT),
        GRAPH_AI_TUTOR_VAULT_DIR: "data/vault-e2e"
      }
    },
    {
      command: `pnpm -C apps/web exec vite --host 127.0.0.1 --port ${E2E_WEB_PORT} --strictPort`,
      url: E2E_WEB_BASE_URL,
      reuseExistingServer: false,
      env: {
        VITE_API_TARGET: E2E_API_BASE_URL
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
