import { expect, test } from "@playwright/test";

test("distill shows a proposal diff, apply updates L1/L2, revert restores", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();

  const panel = page.getByRole("region", { name: /concept/i });
  await expect(panel.getByTestId("concept-title")).toHaveText(/kv cache/i);

  await panel.getByTestId("distill-run").click();

  const diff = panel.getByTestId("draft-revision-diff");
  await expect(diff).toBeVisible();
  await expect(diff).toContainText("Avoids recomputing attention");

  const revisionId = (await panel.getByTestId("draft-revision-id").innerText()).trim();

  await panel.getByTestId("draft-revision-apply").click();

  await expect(panel.locator("li", { hasText: /avoids recomputing attention/i }).first()).toBeVisible();
  await expect(panel.locator("li", { hasText: /during decoding, compute q/i }).first()).toBeVisible();

  const details = panel.locator("details").filter({ hasText: revisionId }).first();
  await details.locator("summary").click();
  await details.getByTestId(`revision-${revisionId}-revert`).click();

  await expect(panel.locator("li", { hasText: /speeds up decoding/i }).first()).toBeVisible();
  await expect(panel.getByText(/\(no l2 yet\)/i)).toBeVisible();
});
