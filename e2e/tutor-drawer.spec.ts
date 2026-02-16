import { expect, test } from "@playwright/test";

test("tutor drawer replaces right-pane tutor tab in V2 and opens from Ask Tutor", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: true,
        autoLensOnSelectEnabled: false
      })
    );
  });

  await page.goto("/");
  await page.getByRole("button", { name: /kv cache/i }).click();

  await expect(page.getByRole("button", { name: /^Tutor$/i })).toHaveCount(0);

  await page.getByRole("button", { name: /^Ask Tutor$/i }).click();
  await expect(page.getByTestId("tutor-drawer-panel")).toBeVisible();
  await expect(page.getByLabel(/question/i)).toHaveValue(
    /Explain KV Cache with prerequisites and examples\./i
  );

  await page.getByRole("button", { name: /^Close$/i }).click();
  await expect(page.getByTestId("tutor-drawer-panel")).toHaveCount(0);
});
