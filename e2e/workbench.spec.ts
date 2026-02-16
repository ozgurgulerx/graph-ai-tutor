import { expect, test } from "@playwright/test";

test("V2 routes Inbox/Review into Workbench modal via counters and command palette", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "graph-ai-tutor.uiFlags.v1",
      JSON.stringify({
        designV2Enabled: true,
        rightPaneV2Enabled: false,
        conceptInspectorV2Enabled: true,
        tutorDrawerEnabled: false,
        autoLensOnSelectEnabled: false
      })
    );
  });

  await page.goto("/");

  await expect(page.getByTestId("topbar-inbox-count")).toBeVisible();
  await expect(page.getByTestId("topbar-review-count")).toBeVisible();

  const tablist = page.getByRole("tablist", { name: /right panel tabs/i });
  await expect(tablist.getByRole("button", { name: /^Inbox$/i })).toHaveCount(0);
  await expect(tablist.getByRole("button", { name: /^Review$/i })).toHaveCount(0);

  await page.getByTestId("topbar-inbox-count").click();
  await expect(page.getByTestId("workbench-modal")).toBeVisible();
  await expect(page.getByTestId("inbox-panel")).toBeVisible();

  await page.getByRole("button", { name: /^Close$/i }).click();
  await expect(page.getByTestId("workbench-modal")).toHaveCount(0);

  await page.keyboard.press("Control+K");
  await page.getByRole("option", { name: /^Open Review Queue$/i }).click();

  await expect(page.getByTestId("workbench-modal")).toBeVisible();
  await expect(page.getByTestId("review-panel")).toBeVisible();
});
