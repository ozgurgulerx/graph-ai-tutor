import { expect, test } from "@playwright/test";

test("apply a changeset adds a node visible on the atlas", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /inbox/i }).click();
  await expect(page.getByTestId("inbox-panel")).toBeVisible();

  await page.getByTestId("changeset-changeset_seed_1").click();

  const acceptConcept = page.getByTestId("changeset-item-changeset_item_seed_concept_1-accept");
  const acceptEdge = page.getByTestId("changeset-item-changeset_item_seed_edge_1-accept");
  await expect(acceptConcept).toBeVisible();
  await expect(acceptEdge).toBeVisible();

  if (await acceptConcept.isEnabled()) {
    await acceptConcept.click();
    await acceptEdge.click();

    const apply = page.getByTestId("changeset-apply");
    await expect(apply).toBeEnabled();
    await apply.click();
  }

  await expect(page.getByRole("button", { name: /paged attention/i })).toBeVisible({
    timeout: 10_000
  });

  await page.waitForFunction(() => {
    const cy = (window as unknown as { __CY__?: unknown }).__CY__;
    if (!cy) return false;
    const nodes = (cy as { nodes: () => Array<{ data: (key: string) => unknown }> }).nodes();
    return nodes.some((n) => String(n.data("label")).toLowerCase() === "paged attention");
  });
});
