import { expect, test } from "@playwright/test";

test("edit local source title line autosaves and persists after reload", async ({ page }) => {
  const title = `Local Notes ${Date.now()}`;
  const modA = process.platform === "darwin" ? "Meta+A" : "Control+A";

  await page.goto("/");

  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByTestId("tab-sources").click();

  await page.getByRole("button", { name: /new local note/i }).click();

  const panel = page.getByTestId("source-panel");
  await expect(panel.getByTestId("source-title")).toHaveText(/kv cache notes/i);

  // Enter edit mode via the editor toggle.
  await panel.getByRole("button", { name: /edit/i }).click();

  // Replace full content so the first heading updates the Source title.
  await panel.locator(".cm-content").click();
  await page.keyboard.press(modA);
  await page.keyboard.type(`# ${title}\n\nSome notes.\n`);

  await expect(panel.getByText(/saved/i)).toBeVisible();

  await page.reload();
  await page.getByTestId("tab-sources").click();

  // Re-open the source from the concept sources list.
  await page.getByRole("button", { name: title }).click();
  await expect(panel.getByTestId("source-title")).toHaveText(title);
});
