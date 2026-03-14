const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/monster-mint.html");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test("can create and manipulate a token template", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("heading", { name: "Monster Mint" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Designer" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Create Token" }).click();

  const initialScroll = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  expect(initialScroll.scrollHeight).toBeLessThanOrEqual(initialScroll.clientHeight + 1);

  await expect(page.getByRole("heading", { name: "Token", exact: true })).toBeVisible();
  await expect(page.locator('select[name="selectedComponentKey"]')).toHaveValue("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token");

  await page.getByRole("button", { name: "Add Text" }).click();
  await expect(page.getByRole("heading", { name: "Selected Component" })).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="name"]')).toHaveValue("Text #1");
  await expect(page.locator('form[data-form="text-component-settings"] select[name="contentMode"]')).toHaveValue("custom");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="customText"]')).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequenceStart"]')).toBeHidden();

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

  await page.locator('[data-preview-stage]').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toBeVisible();

  await page.reload();
  await page.locator('select[name="selectedComponentKey"]').selectOption("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token");
});

test("token settings own appearance controls and color sequences show in preview", async ({ page }) => {
  await page.getByRole("button", { name: "Create Token" }).click();
  const componentOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(componentOptions).not.toContain("Background");
  expect(componentOptions).not.toContain("Border");

  await expect(page.locator('form[data-form="token-settings"] input[name="borderWidthRatio"]')).toHaveAttribute("max", "0.25");
  const tokenBorderPicker = page.locator('.color-picker-field').filter({ hasText: "Token border" });
  await tokenBorderPicker.locator("summary").click();
  await page.locator('select[name="borderColorSource"]').selectOption({ label: "Rainbow" });

  await expect(page.locator('[data-preview-stage] svg circle[stroke="#ff0000"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator('form[data-form="token-settings"]')).toBeVisible();

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

test("built-in text modes and color sequences drive the editor and print limits", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import JSON" })).toBeVisible();
  await expect(page.getByText("Text Sequences")).toHaveCount(0);

  await page.getByRole("button", { name: "New Custom" }).first().click();
  await expect(page.locator('[data-drawer="settings"]')).toBeVisible();
  await page.locator('form[data-form="color-sequence"] input[name="name"]').fill("Two Colors");
  await page.locator('form[data-form="color-sequence"] input[name="name"]').blur();
  await page.locator('form[data-form="color-sequence"] textarea[name="valuesText"]').fill("#111111\n#eeeeee");
  await page.locator('form[data-form="color-sequence"] textarea[name="valuesText"]').blur();

  await page.getByRole("tab", { name: "Designer" }).click();
  await page.getByRole("button", { name: "Create Token" }).click();
  await page.getByRole("button", { name: "Add Text" }).click();
  await page.locator('form[data-form="text-component-settings"] select[name="contentMode"]').selectOption("numeric");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequenceStart"]')).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequencePad"]')).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="customText"]')).toBeHidden();
  const textColorPicker = page.locator('form[data-form="text-component-settings"] .color-picker-field').filter({ hasText: "Text color" });
  await textColorPicker.locator("summary").click();
  await page.locator('form[data-form="text-component-settings"] select[name="colorSource"]').selectOption({ label: "Two Colors" });

  await page.locator('form[data-form="text-component-settings"] select[name="contentMode"]').selectOption("alphabetic");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequenceStart"]')).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequencePad"]')).toBeHidden();
  await page.locator('form[data-form="text-component-settings"] select[name="contentMode"]').selectOption("custom");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="customText"]')).toBeVisible();

  await page.getByRole("tab", { name: "Print" }).click();
  await expect(page.locator('form[data-form="page-settings"] select[name="pagePresetId"]')).toBeVisible();
  const copiesInput = page.locator('input[name^="copies-"]').first();
  await expect(copiesInput).toHaveAttribute("max", "2");

  await copiesInput.fill("5");
  await page.getByRole("button", { name: "Save Print Selections" }).click();
  await expect(copiesInput).toHaveValue("2");
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();
  await expect(page.locator('[data-action="select-preview-page"]')).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Page 1" })).toBeVisible();
});
