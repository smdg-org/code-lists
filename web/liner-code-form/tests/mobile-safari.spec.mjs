import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"], browserName: "webkit" });

test("mobile Safari: empty and populated dates align with Remarks without overflowing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const value of ["", "2026-10-18"]) {
      for (const id of ["validFrom", "validTo"]) {
        const input = page.locator(`#${id}`);
        await input.fill(value);
        await expect(input).toHaveValue(value);
        const bounds = await input.evaluate(element => {
          const inputBounds = element.getBoundingClientRect();
          const remarksBounds = document.getElementById("remarks").getBoundingClientRect();
          return { left: inputBounds.left, right: inputBounds.right,
            remarksLeft: remarksBounds.left, remarksRight: remarksBounds.right };
        });
        expect(bounds.left).toBeCloseTo(bounds.remarksLeft, 1);
        expect(bounds.right).toBeCloseTo(bounds.remarksRight, 1);
        expect(bounds.right).toBeLessThan(width);
      }
    }
  }
});

test("mobile Safari: reviewer cards, date editor and publication dialog fit the screen", async ({ page }) => {
  await page.goto("/reviewer.html");
  await page.getByLabel("Demo username").fill("linercodelists");
  await page.getByLabel("Demo password").fill("SMDGLCL2026");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.locator(".task-card")).toHaveCount(3);
  await page.locator('.task-card[data-mode="add"]').getByRole("button").click();
  await page.getByLabel("Assigned to", { exact: true }).selectOption("Jasmin Dronner");
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.locator("#edit-validFrom")).toBeEnabled();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const value of ["", "2026-10-18"]) {
      for (const id of ["edit-validFrom", "edit-validTo"]) {
        await page.locator(`#${id}`).fill(value);
        const bounds = await page.locator(`#${id}`).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
  await page.locator("#edit-validFrom").fill("2026-10-18");
  await page.locator("#edit-validTo").fill("");
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator("#request-heading")).toContainText("Published - demo");
  await page.reload();
  await expect(page.locator("#login-step")).toBeVisible();
});
