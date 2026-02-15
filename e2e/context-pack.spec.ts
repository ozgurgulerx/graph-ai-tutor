import { expect, test } from "@playwright/test";

test("generate context pack and view in center pane", async ({ page }) => {
  await page.goto("/");

  // Select a concept from the sidebar
  const firstConcept = page.getByRole("list", { name: /concepts/i }).getByRole("button").first();
  await firstConcept.click();

  const panel = page.getByRole("region", { name: /concept/i });
  await expect(panel.getByTestId("concept-title")).toBeVisible();

  // Click Generate context
  await panel.getByTestId("context-pack-generate").click();

  // Verify center pane switches to context pack viewer
  await expect(page.getByTestId("context-pack-viewer")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: /context pack/i })).toBeVisible();

  // Verify back to atlas works
  await page.getByRole("button", { name: /back to atlas/i }).click();
  await expect(page.getByTestId("atlas")).toBeVisible();
});
