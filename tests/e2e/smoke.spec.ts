import { test, expect } from "@playwright/test";

// Placeholder so the E2E project is wired and `playwright test --list` succeeds.
// Real lifecycle scenarios land in Phase 7.
test("tournament landing page loads", async ({ page }) => {
  await page.goto("/longvolleyball");
  await expect(page).toHaveTitle(/.+/);
});
