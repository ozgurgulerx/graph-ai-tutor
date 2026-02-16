import { expect, test } from "@playwright/test";

test("can attach a source url to a concept and see it without refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();
  await expect(page.getByTestId("concept-title")).toHaveText(/kv cache/i);
  await page.getByTestId("tab-sources").click();

  await page.getByLabel(/source url/i).fill("https://example.com/source-1");
  await page.getByLabel(/title/i).fill("Example Source");
  await page.getByRole("button", { name: /attach source/i }).click();

  await expect(page.getByRole("link", { name: /example source/i })).toBeVisible();
});
