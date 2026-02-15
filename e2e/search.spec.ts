import { expect, test } from "@playwright/test";

test("universal search supports facets, neighborhood scope, and show-in-graph focus", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /kv cache/i })).toBeVisible();

  await page.waitForFunction(() => {
    const cy = (window as unknown as { __CY__?: { nodes: () => { length: number } } }).__CY__;
    return Boolean(cy && cy.nodes().length > 0);
  });

  await page.getByRole("button", { name: /kv cache/i }).click();
  await expect(page.getByTestId("concept-title")).toHaveText(/kv cache/i);

  await page.getByLabel("Search").fill("RAG");

  const scope = page.getByLabel(/scope/i);
  await expect(scope).toBeVisible();
  await expect(scope).toHaveValue("neighborhood");

  await scope.selectOption("global");
  await expect(scope).toHaveValue("global");

  const show = page.getByTestId("search-show-genai.knowledge_memory.rag");
  await expect(show).toBeVisible();

  // Neighborhood scope should filter out the RAG major area.
  await scope.selectOption("neighborhood");
  await expect(scope).toHaveValue("neighborhood");
  await expect(show).toHaveCount(0);

  await scope.selectOption("global");
  await expect(scope).toHaveValue("global");
  await expect(show).toBeVisible();
  await show.click();

  await expect(page.getByTestId("concept-title")).toHaveText(/retrieval-augmented generation/i);

  await page.waitForFunction(() => {
    const id = new URLSearchParams(window.location.search).get("conceptId");
    const cy = (window as unknown as { __CY__?: any }).__CY__;
    if (!id || !cy) return false;
    const node = cy.$id(id);
    return Boolean(node && typeof node.hasClass === "function" && node.hasClass("searchFocused"));
  });
});
