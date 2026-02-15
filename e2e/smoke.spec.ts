import { expect, test } from "@playwright/test";

test("selecting a concept opens it in the Concept Workspace panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();
  await expect(page.getByTestId("concept-title")).toHaveText(/kv cache/i);
});

test("clicking a node in the atlas opens the concept title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /kv cache/i })).toBeVisible();

  await page.waitForFunction(() => {
    const cy = (window as unknown as { __CY__?: { nodes: () => { length: number } } }).__CY__;
    return Boolean(cy && cy.nodes().length > 0);
  });

  const clicked = await page.evaluate(() => {
    const maybe = (window as unknown as { __CY__?: unknown }).__CY__;
    if (!maybe) throw new Error("Missing window.__CY__");

    const cy = maybe as {
      nodes: () => Array<{
        data: (key: string) => unknown;
        renderedBoundingBox: () => { x1: number; x2: number; y1: number; y2: number };
      }>;
      container: () => { getBoundingClientRect: () => { left: number; top: number } };
    };

    const node = cy.nodes()[0];
    const label = String(node.data("label"));

    const bb = node.renderedBoundingBox();
    const rect = cy.container().getBoundingClientRect();
    const x = rect.left + (bb.x1 + bb.x2) / 2;
    const y = rect.top + (bb.y1 + bb.y2) / 2;
    return { x, y, label };
  });

  await page.mouse.click(clicked.x, clicked.y);
  await expect(page.getByTestId("concept-title")).toHaveText(clicked.label);
});
