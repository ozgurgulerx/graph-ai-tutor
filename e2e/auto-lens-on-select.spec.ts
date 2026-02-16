import { expect, test } from "@playwright/test";

function enableAutoLensFlags() {
  window.localStorage.setItem(
    "graph-ai-tutor.uiFlags.v1",
    JSON.stringify({
      designV2Enabled: true,
      rightPaneV2Enabled: false,
      conceptInspectorV2Enabled: false,
      tutorDrawerEnabled: false,
      autoLensOnSelectEnabled: true
    })
  );
}

test("auto dependency-first lens is applied on concept select when enabled", async ({ page }) => {
  await page.addInitScript(enableAutoLensFlags);
  await page.goto("/");

  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByRole("button", { name: /^filters$/i }).click();

  await expect(page.locator("#view-mode-select")).toHaveValue("lens");
  await expect(page.locator("#edge-vis-mode-select")).toHaveValue("prereq_only");
});

test("manual view override blocks auto until auto toggle is re-enabled", async ({ page }) => {
  await page.addInitScript(enableAutoLensFlags);
  await page.goto("/");

  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByRole("button", { name: /^filters$/i }).click();

  await page.locator("#view-mode-select").selectOption("classic");
  await page.locator("#edge-vis-mode-select").selectOption("all");
  await expect(page.getByTestId("auto-view-override-hint")).toBeVisible();

  await page.getByRole("button", { name: /^browse$/i }).click();
  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByRole("button", { name: /^filters$/i }).click();

  await expect(page.locator("#view-mode-select")).toHaveValue("classic");
  await expect(page.locator("#edge-vis-mode-select")).toHaveValue("all");

  const autoToggle = page.getByLabel("Auto dependency view on select");
  await autoToggle.click();
  await autoToggle.click();

  await page.getByRole("button", { name: /^browse$/i }).click();
  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByRole("button", { name: /^filters$/i }).click();

  await expect(page.locator("#view-mode-select")).toHaveValue("lens");
  await expect(page.locator("#edge-vis-mode-select")).toHaveValue("prereq_only");
});
