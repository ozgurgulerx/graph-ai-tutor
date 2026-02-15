import { expect, test } from "@playwright/test";

test("mastery overlay toggles mastery bucket classes on atlas nodes", async ({ page }) => {
  await page.goto("/");

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

      const cy = maybe as { nodes: () => Array<{ hasClass: (name: string) => boolean }> };
      const node = cy.nodes()[0];
      if (!node) throw new Error("No nodes found");
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

