import { expect, test } from "@playwright/test";

import { E2E_API_BASE_URL } from "./e2e-ports";

test("selecting an edge shows its evidence chunks", async ({ page }) => {
  const edgeRes = await page.request.post(`${E2E_API_BASE_URL}/edge`, {
    data: {
      fromConceptId: "genai.systems_inference.kvcache.kv_cache",
      toConceptId: "genai.models.transformer.attention.self_attention",
      type: "USED_IN",
      sourceUrl: "seed://kv-cache",
      evidenceChunkIds: ["chunk_seed_kv_1"]
    }
  });
  expect(edgeRes.ok()).toBe(true);
  const edgeJson = (await edgeRes.json()) as { edge?: { id?: string } };
  const edgeId = edgeJson.edge?.id;
  expect(typeof edgeId).toBe("string");

  await page.goto("/");

  await page.waitForFunction(() => {
    const w = window as unknown as { __CY__?: { edges: () => { length: number } } };
    const cy = w.__CY__;
    return Boolean(cy && cy.edges().length > 0);
  });

  await page.evaluate((edgeId) => {
    const w = window as unknown as {
      __CY__?: {
        $id: (id: string) => { 0?: { emit: (event: string) => void }; empty: () => boolean };
      };
    };
    const cy = w.__CY__;
    if (!cy) throw new Error("Cytoscape instance missing from window.__CY__");
    const hit = cy.$id(edgeId);
    if (!hit || hit.empty() || !hit[0]) throw new Error(`Missing edge ${edgeId}`);
    hit[0].emit("tap");
  }, edgeId as string);

  const panel = page.getByTestId("edge-evidence-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("During autoregressive decoding");
  await expect(panel.getByRole("link", { name: /kv cache notes/i })).toHaveAttribute(
    "href",
    "seed://kv-cache"
  );
});
