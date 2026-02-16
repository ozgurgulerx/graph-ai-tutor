import { expect, test } from "@playwright/test";

test("focus mode dims non-neighborhood nodes and depth expands the neighborhood", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /kv cache/i })).toBeVisible();

  await page.waitForFunction(() => {
    const cy = (window as unknown as { __CY__?: { nodes: () => { length: number } } }).__CY__;
    return Boolean(cy && cy.nodes().length > 0);
  });

  await page.getByRole("button", { name: /kv cache/i }).click();
  await page.getByRole("button", { name: /^filters$/i }).click();

  const viewMode = page.getByLabel(/view mode/i);
  await expect(viewMode).toBeVisible();
  await viewMode.selectOption("focus");

  const depth = page.getByLabel(/focus depth/i);
  await expect(depth).toBeVisible();

  await depth.selectOption("1");
  await page.waitForFunction(() => {
    const maybe = (window as unknown as { __CY__?: unknown }).__CY__;
    if (!maybe) return false;
    const cy = maybe as { nodes: () => { forEach: (fn: (n: any) => void) => void } };
    let anyDimmed = false;
    cy.nodes().forEach((n) => {
      if (n && typeof n.hasClass === "function" && n.hasClass("dimmed")) anyDimmed = true;
    });
    return anyDimmed;
  });

  const stats1 = await page.evaluate(() => {
    const maybe = (window as unknown as { __CY__?: unknown }).__CY__;
    if (!maybe) throw new Error("Missing window.__CY__");

    const cy = maybe as {
      nodes: () => Array<{ hasClass: (name: string) => boolean }>;
    };

    let dimmed = 0;
    let undimmed = 0;
    for (const n of cy.nodes()) {
      if (n.hasClass("dimmed")) dimmed++;
      else undimmed++;
    }
    return { dimmed, undimmed };
  });

  expect(stats1.dimmed).toBeGreaterThan(0);
  expect(stats1.undimmed).toBeGreaterThan(0);

  await depth.selectOption("3");

  const stats3 = await page.evaluate(() => {
    const maybe = (window as unknown as { __CY__?: unknown }).__CY__;
    if (!maybe) throw new Error("Missing window.__CY__");

    const cy = maybe as {
      nodes: () => Array<{ hasClass: (name: string) => boolean }>;
    };

    let dimmed = 0;
    let undimmed = 0;
    for (const n of cy.nodes()) {
      if (n.hasClass("dimmed")) dimmed++;
      else undimmed++;
    }
    return { dimmed, undimmed };
  });

  expect(stats3.undimmed).toBeGreaterThanOrEqual(stats1.undimmed);
});
