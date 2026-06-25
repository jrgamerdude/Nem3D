import { expect, test } from "@playwright/test";

test("Nem3D starts with usable editor chrome", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nem3D", exact: true })).toBeVisible();
  await expect(page.getByTitle("Åbn GLB/GLTF")).toBeVisible();
  await expect(page.getByTitle("Gem projekt")).toBeDisabled();

  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: /Prøv eksempel/i }).click();

  await expect(page.getByText(/Modellen er indlæst/)).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(300);
  expect(box?.height).toBeGreaterThan(300);
});
