import { expect, test } from "@playwright/test";

test("selecting a concept opens it in the Concept panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();
  await expect(page.getByTestId("concept-title")).toHaveText(/kv cache/i);
});
