import { expect, test } from "@playwright/test";

test("edit L0, save, reload, persists", async ({ page }) => {
  const value = `E2E L0 ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();

  const panel = page.getByRole("region", { name: /concept/i });
  await expect(panel.getByTestId("concept-title")).toHaveText(/kv cache/i);

  await panel.getByRole("button", { name: /^edit$/i }).click();
  await expect(panel.getByRole("textbox", { name: /edit l0/i })).toBeVisible();
  await panel.getByRole("textbox", { name: /edit l0/i }).fill(value);
  await panel.getByRole("button", { name: /^save$/i }).click();

  await expect(panel.getByText(value)).toBeVisible();

  await page.reload();
  await expect(panel.getByText(value)).toBeVisible();
});
