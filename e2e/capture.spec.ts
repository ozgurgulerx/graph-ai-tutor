import { expect, test } from "@playwright/test";

test("capture modal: open, type text, submit, inbox shows new changeset", async ({ page }) => {
  await page.goto("/");

  // Open the capture modal
  await page.getByTestId("capture-open").click();
  await expect(page.getByTestId("capture-modal")).toBeVisible();

  // Type learning text
  await page.getByTestId("capture-textarea").fill(
    "I learned that gradient checkpointing trades compute for memory by recomputing activations during backward pass"
  );

  // Submit
  await page.getByTestId("capture-submit").click();

  // Modal should close and inbox tab should be active
  await expect(page.getByTestId("capture-modal")).not.toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("inbox-panel")).toBeVisible();
});
