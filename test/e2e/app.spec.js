const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/monster-mint.html");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test("can create and manipulate a token template", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Monster Mint" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Designer" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Create Token" }).click();

  await expect(page.getByRole("heading", { name: "Token", exact: true })).toBeVisible();
  await expect(page.locator('select[name="selectedComponentKey"]')).toHaveValue("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token");

  await page.getByRole("button", { name: "Add Text" }).click();
  await expect(page.getByRole("heading", { name: "Selected Component" })).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] select[name="contentMode"]')).toHaveValue("custom");

  const xInput = page.locator('form[data-form="text-component-settings"] input[name="x"]');
  const yInput = page.locator('form[data-form="text-component-settings"] input[name="y"]');
  await expect(xInput).toHaveValue("0.00");
  await expect(yInput).toHaveValue("0.00");

  await xInput.fill("0");
  await xInput.blur();
  await expect(xInput).toHaveValue("0.00");

  const moveHandle = page.locator('[data-component-type="text"] [data-drag-mode="move"]').first();
  const moveBox = await moveHandle.boundingBox();
  if (!moveBox) {
    throw new Error("Missing text drag handle");
  }
  await page.mouse.move(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveBox.x + moveBox.width / 2 + 60, moveBox.y + moveBox.height / 2 + 30, { steps: 10 });
  await page.mouse.up();

  await expect(xInput).not.toHaveValue("0.00");
  await expect(yInput).not.toHaveValue("0.00");

  const resizeHandle = page.locator('[data-component-type="text"] [data-drag-mode="resize"]').first();
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) {
    throw new Error("Missing text resize handle");
  }
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 40, resizeBox.y + resizeBox.height / 2 + 20, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('form[data-form="text-component-settings"] input[name="width"]')).not.toHaveValue("0.50");

  await page.reload();
  await page.locator('select[name="selectedComponentKey"]').selectOption("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token");
});

test("back face supports built-in components and image transforms", async ({ page }) => {
  await page.getByRole("button", { name: "Create Token" }).click();
  await page.getByRole("button", { name: "Back" }).click();

  const componentOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(componentOptions).toContain("Background");
  expect(componentOptions).toContain("Border");

  await page.locator('select[name="selectedComponentKey"]').selectOption({ label: "Border" });
  await expect(page.locator('form[data-form="border-component-settings"] input[name="borderWidthRatio"]')).toHaveAttribute("max", "0.25");

  await page.locator('select[name="selectedComponentKey"]').selectOption({ label: "Background" });
  await expect(page.locator('form[data-form="background-component-settings"]')).toBeVisible();

  await page.getByRole("button", { name: "Add Image" }).click();
  await page.locator('[data-image-upload-input]').setInputFiles({
    name: "token.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>')
  });

  await expect(page.locator('form[data-form="image-component-settings"] input[name="x"]')).toHaveValue("0.00");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="y"]')).toHaveValue("0.00");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="scale"]')).toHaveValue("0.50");

  await page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]').fill("45");
  await page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]').blur();
  await page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]').check();
  await expect(page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]')).toHaveValue("45");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]')).toBeChecked();
});

test("custom sequence limits print copy counts", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import JSON" })).toBeVisible();

  const textManagerOptions = await page.locator('select[name="selectedTextSequenceId"] option').allTextContents();
  expect(textManagerOptions).not.toContain("Numeric");
  expect(textManagerOptions).not.toContain("Alphabet");

  await page.getByRole("button", { name: "New Custom" }).first().click();
  await expect(page.locator('[data-drawer="settings"]')).toBeVisible();
  await page.locator('form[data-form="text-sequence"] input[name="name"]').fill("Two Names");
  await page.locator('form[data-form="text-sequence"] input[name="name"]').blur();
  await page.locator('form[data-form="text-sequence"] select[name="type"]').selectOption("custom");
  await page.locator('form[data-form="text-sequence"] textarea[name="customValuesText"]').fill("Goblin\nOrc");
  await page.locator('form[data-form="text-sequence"] textarea[name="customValuesText"]').blur();

  await page.getByRole("tab", { name: "Designer" }).click();
  await page.getByRole("button", { name: "Create Token" }).click();
  await page.getByRole("button", { name: "Add Text" }).click();
  await page.locator('form[data-form="text-component-settings"] select[name="contentMode"]').selectOption("sequence");
  const componentSequenceOptions = await page.locator('form[data-form="text-component-settings"] select[name="textSequenceRef"] option').allTextContents();
  expect(componentSequenceOptions).toContain("Numeric");
  expect(componentSequenceOptions).toContain("Alphabet");
  await page.locator('form[data-form="text-component-settings"] select[name="textSequenceRef"]').selectOption({ label: "Two Names" });

  await page.getByRole("tab", { name: "Print" }).click();
  const copiesInput = page.locator('input[name^="copies-"]').first();
  await expect(copiesInput).toHaveAttribute("max", "2");

  await copiesInput.fill("5");
  await page.getByRole("button", { name: "Save Print Selections" }).click();
  await expect(copiesInput).toHaveValue("2");
  await expect(page.getByText("Page 1")).toBeVisible();
});
