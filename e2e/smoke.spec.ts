import { expect, test } from "@playwright/test";

test("web loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /graph ai tutor/i })
  ).toBeVisible();
});

