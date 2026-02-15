import { expect, test } from "@playwright/test";

test("Cmd+K opens command palette and can launch training", async ({ page }) => {
  await page.goto("/");

  // Wait for the page to load
  await expect(page.getByRole("button", { name: /kv cache/i })).toBeVisible();

  // Open command palette with Cmd+K
  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();

  // Should show the training action
  await expect(page.getByText("Start training session")).toBeVisible();

  // Close with Escape
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).not.toBeVisible();
});

test("command palette filters actions by query", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /kv cache/i })).toBeVisible();

  await page.keyboard.press("Meta+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();

  const input = page.getByTestId("command-palette-input");
  await input.fill("training");
  await expect(page.getByText("Start training session")).toBeVisible();

  await input.fill("zzzzz");
  await expect(page.getByText("No matching actions")).toBeVisible();

  await page.keyboard.press("Escape");
});
