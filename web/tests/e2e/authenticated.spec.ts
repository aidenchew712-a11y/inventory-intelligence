import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
test("authenticated account can load database-backed stock and export its workspace", async ({ page }) => {
  test.skip(!existsSync(".test-fixture.json"), "Requires the disposable verification identity.");
  const fixture = JSON.parse(readFileSync(".test-fixture.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Let's take stock." })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Inventory", exact: false }).first().click();
  await expect(page.getByRole("row").filter({ hasText: "Concurrency verification stock" })).toContainText("3");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("stockroom-inventory.csv");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
