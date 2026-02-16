import { expect, test } from "@playwright/test";

test("mastery overlay toggles mastery bucket classes on atlas nodes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^filters$/i }).click();

  await page.waitForFunction(() => {
    const cy = (window as unknown as { __CY__?: { nodes: () => { length: number } } }).__CY__;
    return Boolean(cy && cy.nodes().length > 0);
  });

  const toggle = page.getByLabel(/mastery overlay/i);
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();

  const hasMasteryClass = async () => {
    return await page.evaluate(() => {
      const maybe = (window as unknown as { __CY__?: unknown }).__CY__;
      if (!maybe) throw new Error("Missing window.__CY__");

      const cy = maybe as {
        nodes: () => {
          forEach: (fn: (n: { hasClass: (name: string) => boolean; data: (k: string) => unknown }) => void) => void;
        };
      };

      let node: { hasClass: (name: string) => boolean } | null = null;
      cy.nodes().forEach((n) => {
        if (node) return;
        // In clustered mode, Cytoscape includes parent "cluster:*" nodes that do not have mastery classes.
        if (n.data("isCluster")) return;
        node = n;
      });
      if (!node) throw new Error("No concept nodes found");
      return (
        node.hasClass("masteryLow") || node.hasClass("masteryMid") || node.hasClass("masteryHigh")
      );
    });
  };

  expect(await hasMasteryClass()).toBe(false);

  await toggle.check();
  expect(await hasMasteryClass()).toBe(true);

  await toggle.uncheck();
  expect(await hasMasteryClass()).toBe(false);
});
