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
      nodes: () => {
        forEach: (
          fn: (n: {
            data: (key: string) => unknown;
            emit: (event: string) => void;
          }) => void
        ) => void;
      };
    };

    let node: { data: (key: string) => unknown; emit: (event: string) => void } | null = null;
    cy.nodes().forEach((n) => {
      if (node) return;
      if (n.data("isCluster")) return;
      node = n;
    });
    if (!node) throw new Error("No concept nodes found");
    const label = String(node.data("label"));
    node.emit("tap");
    return { label };
  });

  await expect(page.getByTestId("concept-title")).toHaveText(clicked.label);
});
