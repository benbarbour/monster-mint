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
  await expect(page.locator(".designer-drawer .drawer-body")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="name"]')).toHaveValue("Text #1");
  await expect(page.locator('form[data-form="text-component-settings"] select[name="contentMode"]')).toHaveValue("numeric");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="customText"]')).toBeHidden();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequenceStart"]')).toBeVisible();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="sequencePad"]')).toBeVisible();
  const textNode = page.locator('[data-preview-stage] svg text').first();
  const initialFontSize = Number(await textNode.getAttribute("font-size"));
  await page.locator('form[data-form="text-component-settings"] input[name="textBorderWidth"]').fill("6");
  await page.locator('form[data-form="text-component-settings"] input[name="textBorderWidth"]').blur();
  await expect(textNode).toHaveAttribute("stroke-width", "6");
  const strokedFontSize = Number(await textNode.getAttribute("font-size"));
  expect(strokedFontSize).toBeLessThan(initialFontSize);
  const selectedScroll = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight
  }));
  expect(selectedScroll.scrollHeight).toBeLessThanOrEqual(selectedScroll.clientHeight + 1);
  const designerHeights = await page.evaluate(() => {
    const main = document.querySelector(".designer-main");
    const drawer = document.querySelector(".designer-drawer");
    return {
      mainHeight: main ? Math.round(main.getBoundingClientRect().height) : 0,
      drawerHeight: drawer ? Math.round(drawer.getBoundingClientRect().height) : 0
    };
  });
  expect(designerHeights.drawerHeight).toBeLessThanOrEqual(designerHeights.mainHeight + 1);

  const xInput = page.locator('form[data-form="text-component-settings"] input[name="x"]');
  const yInput = page.locator('form[data-form="text-component-settings"] input[name="y"]');
  const moveHandle = page.locator('[data-component-type="text"][data-drag-mode="move"]').first();
  await expect(xInput).toHaveValue("0.00");
  await expect(yInput).toHaveValue("0.00");

  const initialHandleY = (await moveHandle.boundingBox()).y;
  await yInput.fill("0.10");
  await yInput.blur();
  await expect(yInput).toHaveValue("0.10");
  const raisedHandleY = (await moveHandle.boundingBox()).y;
  expect(raisedHandleY).toBeLessThan(initialHandleY);
  await yInput.fill("0");
  await yInput.blur();
  await expect(yInput).toHaveValue("0.00");

  await xInput.fill("0");
  await xInput.blur();
  await expect(xInput).toHaveValue("0.00");

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
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('form[data-form="background-defaults"]')).toBeVisible();
  await page.locator('form[data-form="background-defaults"] select[name="defaultBackgroundMode"]').selectOption("image");
  await page.locator('[data-default-background-input]').setInputFiles({
    name: "default-background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2244ff"/></svg>')
  });
  await expect(page.locator('form[data-form="text-defaults"] select[name="fontFamily"]')).toBeVisible();
  await page.locator('form[data-form="text-defaults"] select[name="fontFamily"]').selectOption("Arial");
  await page.locator('form[data-form="text-defaults"] select[name="fontWeight"]').selectOption("500");
  await page.locator('form[data-form="text-defaults"] input[name="defaultTextBorderWidth"]').fill("1.5");
  await page.locator('form[data-form="text-defaults"] input[name="defaultTextBorderWidth"]').blur();
  await page.getByRole("tab", { name: "Designer" }).click();
  await page.getByRole("button", { name: "Create Token" }).click();
  await expect(page.locator('form[data-form="token-settings"] select[name="backgroundMode"]')).toHaveValue("image");
  await expect(page.locator('[data-preview-stage] svg image[data-background-image="true"]')).toHaveCount(1);
  const componentOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(componentOptions).not.toContain("Background");
  expect(componentOptions).not.toContain("Border");
  await expect(page.getByRole("button", { name: "Copy Front to Back" })).toBeVisible();

  await expect(page.locator('form[data-form="token-settings"] input[name="borderWidthRatio"]')).toHaveAttribute("max", "0.25");
  const tokenBorderPicker = page.locator('.color-picker-field').filter({ hasText: "Token border" });
  await tokenBorderPicker.locator("summary").click();
  await page.locator('select[name="borderColorSource"]').selectOption({ label: "Rainbow" });
  const initialBackgroundHref = await page.locator('[data-preview-stage] svg image[data-background-image="true"]').first().getAttribute("href");
  await page.locator('form[data-form="token-settings"] select[name="backgroundMode"]').selectOption("image");
  await page.locator('[data-token-background-input]').setInputFiles({
    name: "token-background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#22aa44"/></svg>')
  });
  await expect(page.locator('[data-preview-stage] svg image[data-background-image="true"]').first()).not.toHaveAttribute("href", initialBackgroundHref);

  await expect(page.locator('[data-preview-stage] svg circle[stroke="#ff0000"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator('form[data-form="token-settings"]')).toBeVisible();

  const oversizedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><desc>' +
    "A".repeat(1100000) +
    '</desc><rect width="200" height="100" fill="red"/></svg>';
  await page.getByRole("button", { name: "Add Image" }).click();
  await page.locator('[data-image-upload-input]').setInputFiles({
    name: "token.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(oversizedSvg)
  });

  await expect(page.locator('form[data-form="image-component-settings"] input[name="x"]')).toHaveValue("0.00");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="y"]')).toHaveValue("0.00");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="scale"]')).toHaveValue("0.5");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="scale"]')).toHaveAttribute("type", "range");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]')).toHaveAttribute("type", "range");
  await expect(page.locator('[data-preview-stage] svg g[data-component-type="image"] image').first()).toHaveAttribute("href", /data:image\/(jpeg|png|webp);base64,/);

  await page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]').evaluate((element) => {
    element.value = "45";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]').check();
  await expect(page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]')).toHaveValue("45");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]')).toBeChecked();
  await expect(page.locator('[data-preview-stage] svg image[transform*="rotate(45"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Down" })).toBeVisible();
  await page.getByRole("button", { name: "Copy Back to Front" }).click();
  await page.getByRole("button", { name: "Front", exact: true }).click();
  const copiedFrontOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(copiedFrontOptions).toContain("token.svg");
  await page.locator('select[name="selectedComponentKey"]').selectOption({ label: "token.svg" });
  await expect(page.locator('form[data-form="image-component-settings"] input[name="scale"]')).toBeVisible();

  const scaleBeforeWheel = await page.locator('form[data-form="image-component-settings"] input[name="scale"]').inputValue();
  const previewStage = page.locator('[data-preview-stage]');
  const previewBox = await previewStage.boundingBox();
  if (!previewBox) {
    throw new Error("Missing preview stage");
  }
  await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + previewBox.height / 2);
  await page.mouse.wheel(0, -240);
  await expect(page.locator('form[data-form="image-component-settings"] input[name="scale"]')).not.toHaveValue(scaleBeforeWheel);

  await page.locator('form[data-form="image-component-settings"] input[name="scale"]').evaluate((element) => {
    element.value = "2";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await previewStage.click({ position: { x: 10, y: 10 } });
  await expect(page.locator('form[data-form="token-settings"]')).toBeVisible();

  await page.getByRole("button", { name: "Clone" }).click();
  await expect(page.locator('select[name="selectedTokenId"] option')).toHaveCount(2);
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token Copy");

  await page.getByRole("button", { name: "Add Text" }).click();
  await expect(page.locator('form[data-form="text-component-settings"] select[name="fontFamily"]')).toHaveValue("Arial");
  await expect(page.locator('form[data-form="text-component-settings"] select[name="fontWeight"]')).toHaveValue("500");
  await expect(page.locator('form[data-form="text-component-settings"] input[name="textBorderWidth"]')).toHaveValue("1.5");

  await page.getByRole("tab", { name: "Print" }).click();
  const printCopiesInput = page.locator('input[name^="copies-"]').first();
  await printCopiesInput.fill("2");
  await printCopiesInput.blur();
  const previewClippedImageCount = await page.locator('.preview-page-svg g[data-component-type="image"][clip-path*="token-clip-"] image').count();
  expect(previewClippedImageCount).toBeGreaterThan(0);
  const previewClipIds = await page.locator('.preview-page-svg clipPath[id^="token-clip-"]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(previewClipIds).size).toBe(previewClipIds.length);
  await expect(page.locator('.preview-page-svg clipPath[id^="token-clip-"] circle').first()).toHaveAttribute("r", "49.75");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("iframe.print-frame")).toHaveCount(1);
  const frameClippedImageCount = await page.frameLocator("iframe.print-frame").locator('g[data-component-type="image"][clip-path*="token-clip-"] image').count();
  expect(frameClippedImageCount).toBeGreaterThan(0);
  await expect(page.frameLocator("iframe.print-frame").locator('clipPath[id^="token-clip-"] circle').first()).toHaveAttribute("r", "49.75");
});

test("built-in text modes and color sequences drive live print preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await page.locator('form[data-form="text-component-settings"] select[name="contentMode"]').selectOption("numeric");
  await page.locator('form[data-form="text-component-settings"] input[name="sequenceStart"]').fill("1");
  await page.locator('form[data-form="text-component-settings"] input[name="sequencePad"]').fill("0");
  await page.locator('[data-preview-stage]').click({ position: { x: 20, y: 20 } });
  await page.locator('form[data-form="token-settings"] select[name="diameterIn"]').selectOption("5");

  await page.getByRole("tab", { name: "Print" }).click();
  await expect(page.locator('form[data-form="page-settings"] select[name="pagePresetId"]')).toBeVisible();

  await page.getByRole("button", { name: "Print Settings" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Print Settings" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toBeVisible();

  const bleedInput = page.locator('form[data-form="page-settings"] input[name="bleedIn"]');
  await bleedInput.fill("0");
  await bleedInput.blur();
  await expect(bleedInput).toHaveValue("0");

  const copiesInput = page.locator('input[name^="copies-"]').first();
  const startInput = page.locator('input[name^="start-"]').first();
  await expect(startInput).toHaveValue("1");
  await expect(copiesInput).not.toHaveAttribute("max", "2");

  await copiesInput.click();
  await copiesInput.press("ControlOrMeta+A");
  await page.keyboard.press("1");
  await page.keyboard.press("0");
  await expect(copiesInput).toHaveValue("10");
  await startInput.fill("0");
  await startInput.blur();
  await expect(copiesInput).toHaveValue("10");
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Page 2" })).toBeVisible();
  const pageTabCount = await page.locator('[data-action="select-preview-page"]').count();
  expect(pageTabCount).toBeGreaterThan(1);
  await expect(page.getByRole("tab", { name: "Page 1" })).toBeVisible();
  await expect(page.locator(".preview-tab-list")).toHaveCSS("overflow-x", "auto");

  const pageWidths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);

  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("iframe.print-frame")).toHaveCount(1);
});
