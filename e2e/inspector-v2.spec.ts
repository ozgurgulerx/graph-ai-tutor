import { expect, test } from "@playwright/test";

test("inspector v2 shows sectioned layout behind flags and preserves workspace actions", async ({
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
  await page.getByRole("button", { name: /kv cache/i }).click();

  await expect(page.getByTestId("inspector-section-overview")).toBeVisible();
  await expect(page.getByTestId("inspector-section-relationships")).toBeVisible();
  await expect(page.getByTestId("inspector-section-notes")).toBeVisible();
  await expect(page.getByTestId("inspector-section-quizzes")).toBeVisible();
  await expect(page.getByTestId("inspector-section-sources")).toBeVisible();
  await expect(page.getByTestId("inspector-section-advanced")).toBeVisible();
  await expect(page.getByRole("button", { name: /generate quiz/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit$/ })).toBeVisible();

  await page.getByRole("button", { name: /\+ note/i }).click();
  await expect(page.getByTestId("concept-notes-v2")).toBeVisible();
  await expect(page.getByTestId("source-panel")).toBeVisible();
});

test("inspector v2 add relation stages draft edge and opens inbox", async ({ page }) => {
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
  await page.getByRole("button", { name: /kv cache/i }).click();

  await page.getByRole("button", { name: /^add relation$/i }).click();
  await expect(page.getByTestId("relationships-composer")).toBeVisible();

  await page.getByTestId("relation-target-query").fill("paged");
  await expect(page.getByTestId("relation-target-results")).toBeVisible();
  await page.getByTestId("relation-target-results").getByRole("button").first().click();

  await page.getByTestId("relation-submit").click();

  await expect(page.getByText("Draft edge added to Inbox")).toBeVisible();
  await expect(page.getByTestId("inbox-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: /apply accepted/i })).toBeVisible();
});
