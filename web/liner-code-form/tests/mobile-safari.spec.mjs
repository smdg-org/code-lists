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
