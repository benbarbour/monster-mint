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
  await expect(page.getByRole("link", { name: "GitHub Repository" })).toHaveAttribute("href", "https://github.com/benbarbour/monster-mint");
  const headerActionOrder = await page.locator(".app-menu .app-menu-group .menu-button").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label"))
  );
  expect(headerActionOrder).toEqual([
    "Export JSON",
    "Import JSON",
    "Reset Project",
    "Load Latest Example",
    "Hotkey Help",
    "Settings"
  ]);
  await page.getByRole("button", { name: "Hotkey Help" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Help \([^)]+\)/ })).toBeVisible();
  await expect(page.getByText("Delete the selected designer component.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
  await expect(page.locator('form[data-form="text-component-settings"] input[name="rotationDeg"]')).toHaveAttribute("type", "number");
  await expect(page.locator('[data-component-type="text"] [data-drag-mode="rotate"]').first()).toBeVisible();
  await expect(page.locator('[data-component-type="text"][data-drag-mode="move"]').first()).toHaveAttribute("cursor", "default");
  const textNode = page.locator('[data-preview-stage] svg text').first();
  const initialFontSize = Number(await textNode.getAttribute("font-size"));
  await page.locator('form[data-form="text-component-settings"] input[name="rotationDeg"]').fill("15");
  await page.locator('form[data-form="text-component-settings"] input[name="rotationDeg"]').blur();
  await expect(textNode).toHaveAttribute("transform", /rotate\(15 /);
  const textRotateHandle = page.locator('[data-component-type="text"] [data-drag-mode="rotate"]').first();
  const textRotateBox = await textRotateHandle.boundingBox();
  if (!textRotateBox) {
    throw new Error("Missing text rotate handle");
  }
  await page.mouse.move(textRotateBox.x + textRotateBox.width / 2, textRotateBox.y + textRotateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(textRotateBox.x + textRotateBox.width / 2 + 30, textRotateBox.y + textRotateBox.height / 2 + 20, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('form[data-form="text-component-settings"] input[name="rotationDeg"]')).not.toHaveValue("15");
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
  await page.locator(".designer-drawer .drawer-body").evaluate((element) => {
    element.scrollTop = 240;
  });
  const scrollBeforeEdit = await page.locator(".designer-drawer .drawer-body").evaluate((element) => element.scrollTop);
  expect(scrollBeforeEdit).toBeGreaterThan(0);

  const xInput = page.locator('form[data-form="text-component-settings"] input[name="x"]');
  const yInput = page.locator('form[data-form="text-component-settings"] input[name="y"]');
  const moveHandle = page.locator('[data-component-type="text"][data-drag-mode="move"]').first();
  await expect(xInput).toHaveValue("0.00");
  await expect(yInput).toHaveValue("0.00");

  const initialHandleY = (await moveHandle.boundingBox()).y;
  await yInput.fill("0.10");
  await yInput.blur();
  await expect(yInput).toHaveValue("0.10");
  const scrollAfterEdit = await page.locator(".designer-drawer .drawer-body").evaluate((element) => element.scrollTop);
  expect(scrollAfterEdit).toBeGreaterThan(0);
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
  await expect(page.locator('[data-component-type="text"] [data-drag-mode="resize-left"]').first()).toHaveAttribute("cursor", "ew-resize");
  await expect(page.locator('[data-component-type="text"] [data-drag-mode="resize-top"]').first()).toHaveAttribute("cursor", "ns-resize");
  await expect(page.locator('[data-component-type="text"] [data-drag-mode="resize-right"]').first()).toHaveAttribute("cursor", "ew-resize");

  await page.locator('[data-preview-stage]').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toBeVisible();
  await page.keyboard.press("Shift+/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Help \([^)]+\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Add Text" }).click();
  await expect(page.locator('form[data-form="text-component-settings"]')).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(page.locator('form[data-form="text-component-settings"]')).toHaveCount(0);
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toBeVisible();

  await page.reload();
  await page.locator('select[name="selectedComponentKey"]').selectOption("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Untitled Token");
});

test("transparent image pixels fall through to the thing underneath", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Create Token" }).click();
  await page.getByRole("button", { name: "Add Image" }).click();
  await page.locator('[data-image-upload-input]').setInputFiles({
    name: "transparent-token.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><path fill="#cc2222" fill-rule="evenodd" d="M0 0h300v300H0z M90 90h120v120H90z"/></svg>')
  });

  await expect(page.locator('form[data-form="image-component-settings"]')).toBeVisible();
  const uploadedImage = page.locator('[data-preview-stage] svg g[data-component-type="image"] image').first();
  const imageBox = await uploadedImage.boundingBox();
  if (!imageBox) {
    throw new Error("Missing uploaded image bounding box");
  }

  await page.mouse.click(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await expect(page.locator('form[data-form="token-settings"]')).toBeVisible();
  await expect(page.locator('form[data-form="image-component-settings"]')).toHaveCount(0);
});

test("designer dropdowns are sorted", async ({ page }) => {
  await page.getByRole("button", { name: "Create Token" }).click();
  await page.locator('form[data-form="token-settings"] input[name="name"]').fill("Zulu");
  await page.locator('form[data-form="token-settings"] input[name="name"]').blur();

  await page.getByRole("button", { name: "New Token" }).click();
  await page.locator('form[data-form="token-settings"] input[name="name"]').fill("Alpha");
  await page.locator('form[data-form="token-settings"] input[name="name"]').blur();

  await page.getByRole("button", { name: "New Token" }).click();
  await page.locator('form[data-form="token-settings"] input[name="name"]').fill("Mint 2");
  await page.locator('form[data-form="token-settings"] input[name="name"]').blur();

  const tokenOptions = await page.locator('select[name="selectedTokenId"] option').allTextContents();
  expect(tokenOptions).toEqual([
    'Alpha (1")',
    'Mint 2 (1")',
    'Zulu (1")'
  ]);

  await page.locator('select[name="selectedTokenId"]').selectOption({ label: 'Alpha (1")' });
  await page.getByRole("button", { name: "Add Text" }).click();
  await page.locator('form[data-form="text-component-settings"] input[name="name"]').fill("Zulu Text");
  await page.locator('form[data-form="text-component-settings"] input[name="name"]').blur();

  await page.getByRole("button", { name: "Add Text" }).click();
  await page.locator('form[data-form="text-component-settings"] input[name="name"]').fill("Alpha Text");
  await page.locator('form[data-form="text-component-settings"] input[name="name"]').blur();

  const componentOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(componentOptions).toEqual([
    "Token settings",
    "Alpha Text",
    "Zulu Text"
  ]);

  await page.getByRole("tab", { name: "Print" }).click();
  const printTokenRows = await page.locator(".print-table tbody tr td:first-child").allTextContents();
  expect(printTokenRows).toEqual([
    'Alpha (1")',
    'Mint 2 (1")',
    'Zulu (1")'
  ]);
  await expect(page.locator(".panel-toggle-meta").filter({ hasText: "3 designs" })).toBeVisible();
});

test("token settings own appearance controls and color sequences show in preview", async ({ page }) => {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator('form[data-form="token-defaults"]')).toBeVisible();
  await expect(page.locator('form[data-form="image-import-settings"] input[name="imageTrimAlphaThreshold"]')).toHaveValue("1");
  await page.locator('form[data-form="image-import-settings"] input[name="imageTrimAlphaThreshold"]').fill("2");
  await page.locator('form[data-form="image-import-settings"] input[name="imageTrimAlphaThreshold"]').blur();
  await expect(page.locator('form[data-form="image-import-settings"] input[name="imageTrimAlphaThreshold"]')).toHaveValue("2");
  await page.locator('form[data-form="token-defaults"] select[name="defaultDiameterIn"]').selectOption("2");
  await page.locator('form[data-form="token-defaults"] select[name="defaultBackgroundMode"]').selectOption("image");
  await page.locator('[data-default-background-input]').setInputFiles({
    name: "default-background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2244ff"/></svg>')
  });
  await page.locator('form[data-form="token-defaults"] input[name="defaultBorderWidthRatio"]').evaluate((element) => {
    element.value = "0.07";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const defaultBorderPicker = page.locator('form[data-form="token-defaults"] .color-picker-field').filter({ hasText: "Default token border" });
  await defaultBorderPicker.locator("summary").click();
  await page.locator('select[name="defaultBorderColorSource"]').selectOption({ label: "Rainbow" });
  await expect(page.locator('form[data-form="text-defaults"] select[name="fontFamily"]')).toBeVisible();
  await page.locator('form[data-form="text-defaults"] select[name="fontFamily"]').selectOption("Arial");
  await page.locator('form[data-form="text-defaults"] select[name="fontWeight"]').selectOption("500");
  await page.locator('form[data-form="text-defaults"] input[name="defaultTextBorderWidth"]').fill("1.5");
  await page.locator('form[data-form="text-defaults"] input[name="defaultTextBorderWidth"]').blur();
  await page.getByRole("tab", { name: "Designer" }).click();
  await page.getByRole("button", { name: "Create Token" }).click();
  await expect(page.locator('form[data-form="token-settings"] select[name="diameterIn"]')).toHaveValue("2");
  await expect(page.locator('form[data-form="token-settings"] select[name="backgroundMode"]')).toHaveValue("image");
  await expect(page.locator('form[data-form="token-settings"] input[name="borderWidthRatio"]')).toHaveValue("0.07");
  await expect(page.locator('[data-preview-stage] svg image[data-background-image="true"]')).toHaveCount(1);
  const componentOptions = await page.locator('select[name="selectedComponentKey"] option').allTextContents();
  expect(componentOptions).not.toContain("Background");
  expect(componentOptions).not.toContain("Border");

  await expect(page.locator('form[data-form="token-settings"] input[name="borderWidthRatio"]')).toHaveAttribute("max", "0.25");
  await expect(page.locator('[data-preview-stage] svg circle[stroke="#ff0000"]')).toHaveCount(1);
  await page.locator('form[data-form="token-settings"] .color-picker-field').filter({ hasText: "Token border" }).locator("summary").click();
  await expect(page.locator('form[data-form="token-settings"] input[name="borderColorTransparency"]')).toHaveValue("0");
  await page.locator('form[data-form="token-settings"] input[name="borderColorTransparency"]').evaluate((element) => {
    element.value = "50";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator('form[data-form="token-settings"] input[name="borderColorTransparency"]')).toHaveValue("50");
  const initialBackgroundHref = await page.locator('[data-preview-stage] svg image[data-background-image="true"]').first().getAttribute("href");
  await page.locator('form[data-form="token-settings"] select[name="backgroundMode"]').selectOption("image");
  await page.locator('[data-token-background-input]').setInputFiles({
    name: "token-background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#22aa44"/></svg>')
  });
  await expect(page.locator('[data-preview-stage] svg image[data-background-image="true"]').first()).not.toHaveAttribute("href", initialBackgroundHref);

  const oversizedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><desc>' +
    "A".repeat(1100000) +
    '</desc><rect x="120" y="40" width="60" height="220" fill="red"/></svg>';
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
  await expect(page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]')).toHaveAttribute("type", "number");
  await expect(page.locator('[data-component-type="image"] [data-drag-mode="resize-top"]').first()).toHaveAttribute("cursor", "ns-resize");
  await expect(page.locator('[data-component-type="image"] [data-drag-mode="resize-bottom"]').first()).toHaveAttribute("cursor", "ns-resize");
  await expect(page.locator('[data-component-type="image"] [data-drag-mode="resize-left"]').first()).toHaveAttribute("cursor", "ew-resize");
  await expect(page.locator('[data-component-type="image"] [data-drag-mode="resize-right"]').first()).toHaveAttribute("cursor", "ew-resize");
  const uploadedImage = page.locator('[data-preview-stage] svg g[data-component-type="image"] image').first();
  await expect(uploadedImage).toHaveAttribute("href", /data:image\/(jpeg|png|webp);base64,/);
  await page.getByRole("button", { name: "Down" }).click();
  await expect(page.locator('[data-preview-stage] svg g[data-component-type="image"]').first()).toHaveAttribute("clip-path", /under-border-clip-/);
  await expect(page.locator('[data-preview-stage] svg clipPath[id^="under-border-clip-"] circle').first()).toHaveAttribute("r", "43");
  const uploadedDimensions = await uploadedImage.evaluate((node) => ({
    width: Number(node.getAttribute("width") || 0),
    height: Number(node.getAttribute("height") || 0)
  }));
  expect(uploadedDimensions.width).toBeLessThan(uploadedDimensions.height);

  await page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]').evaluate((element) => {
    element.value = "45";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]').check();
  await expect(page.locator('form[data-form="image-component-settings"] input[name="rotationDeg"]')).toHaveValue("45");
  await expect(page.locator('form[data-form="image-component-settings"] input[name="mirrorX"]')).toBeChecked();
  await expect(page.locator('[data-preview-stage] svg image[transform*="rotate(45"]')).toHaveCount(1);
  const edgeHandle = page.locator('[data-component-type="image"] [data-drag-mode="resize-top"]').first();
  const edgePoint = await edgeHandle.evaluate((element, t) => {
    const x1 = Number(element.getAttribute("x1"));
    const y1 = Number(element.getAttribute("y1"));
    const x2 = Number(element.getAttribute("x2"));
    const y2 = Number(element.getAttribute("y2"));
    const point = element.ownerSVGElement.createSVGPoint();
    point.x = x1 + (x2 - x1) * t;
    point.y = y1 + (y2 - y1) * t;
    const screenPoint = point.matrixTransform(element.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  }, 0.5);
  const edgeHitTarget = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    return target ? target.getAttribute("data-drag-mode") : null;
  }, edgePoint);
  expect(edgeHitTarget).toBe("resize-top");
  const sideHandle = page.locator('[data-component-type="image"] [data-drag-mode="resize-right"]').first();
  const sidePoint = await sideHandle.evaluate((element, t) => {
    const x1 = Number(element.getAttribute("x1"));
    const y1 = Number(element.getAttribute("y1"));
    const x2 = Number(element.getAttribute("x2"));
    const y2 = Number(element.getAttribute("y2"));
    const point = element.ownerSVGElement.createSVGPoint();
    point.x = x1 + (x2 - x1) * t;
    point.y = y1 + (y2 - y1) * t;
    const screenPoint = point.matrixTransform(element.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  }, 0.5);
  const sideHitTarget = await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    return target ? target.getAttribute("data-drag-mode") : null;
  }, sidePoint);
  expect(sideHitTarget).toBe("resize-right");
  await expect(page.getByRole("button", { name: "Up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Down" })).toBeVisible();
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
  const previewClippedImageCount = await page.locator('.preview-page-svg g[data-component-type="image"][clip-path*="token-clip-"] image, .preview-page-svg g[data-component-type="image"][clip-path*="under-border-clip-"] image').count();
  expect(previewClippedImageCount).toBeGreaterThan(0);
  const previewClipIds = await page.locator('.preview-page-svg clipPath[id^="token-clip-"]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(previewClipIds).size).toBe(previewClipIds.length);
  await expect(page.locator('.preview-page-svg clipPath[id^="token-clip-"] circle').first()).toHaveAttribute("r", "49.75");
  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("iframe.print-frame")).toHaveCount(1);
  const frameClippedImageCount = await page.frameLocator("iframe.print-frame").locator('g[data-component-type="image"][clip-path*="token-clip-"] image, g[data-component-type="image"][clip-path*="under-border-clip-"] image').count();
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
  await expect(page.locator('form[data-form="page-settings"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Print Settings" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toBeVisible();
  await page.waitForTimeout(250);
  await page.reload();
  await page.getByRole("tab", { name: "Print" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toBeVisible();
  await page.getByRole("button", { name: "Print Settings" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Print Settings" }).click();
  await expect(page.locator('form[data-form="page-settings"]')).toBeVisible();
  const cutlineGapInput = page.locator('form[data-form="page-settings"] input[name="cutlineGapMm"]');
  await expect(cutlineGapInput).toHaveAttribute("step", "0.5");
  await cutlineGapInput.fill("2.5");
  await cutlineGapInput.blur();
  await expect(cutlineGapInput).toHaveValue("2.5");

  const copiesInput = page.locator('input[name^="copies-"]').first();
  const startInput = page.locator('input[name^="start-"]').first();
  await expect(startInput).toHaveValue("1");
  await expect(copiesInput).not.toHaveAttribute("max", "2");

  await copiesInput.click();
  await copiesInput.press("ControlOrMeta+A");
  await page.keyboard.press("2");
  await page.waitForTimeout(250);
  await page.keyboard.press("4");
  await expect(copiesInput).toHaveValue("24");
  await startInput.click();
  await expect(copiesInput).toHaveValue("24");
  await startInput.fill("0");
  await startInput.blur();
  await expect(copiesInput).toHaveValue("24");
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Page 5", exact: true })).toBeVisible();
  await expect(page.locator(".panel-toggle-meta").filter({ hasText: "24 tokens" })).toBeVisible();
  await expect(page.locator(".panel-toggle-meta").filter({ hasText: "page" })).toBeVisible();
  const pageTabCount = await page.locator('[data-action="select-preview-page"]').count();
  expect(pageTabCount).toBeGreaterThan(1);
  await expect(page.getByRole("tab", { name: "Page 1", exact: true })).toBeVisible();
  await expect(page.locator(".preview-tab-list")).toHaveCSS("overflow-x", "auto");
  await expect(page.locator('[data-cut-gap-fill="true"]').first()).toBeVisible();
  expect(await page.locator('[data-cut-tick="true"]').count()).toBeGreaterThan(0);

  const pageWidths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);

  await page.getByRole("button", { name: "Print", exact: true }).click();
  await expect(page.locator("iframe.print-frame")).toHaveCount(1);
});

test("json import normalizes embedded image assets", async ({ page }) => {
  const paddedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">' +
    '<rect x="120" y="40" width="60" height="220" fill="red"/>' +
    '</svg>';
  const importedProject = {
    version: 1,
    meta: {
      name: "Imported",
      updatedAt: "2026-03-16T00:00:00.000Z"
    },
    settings: {
      pagePresetId: "letter",
      pageOrientation: "portrait",
      pageMarginIn: 0.25,
      bleedIn: 0.0625,
      tokenDefaults: {
        diameterIn: 1,
        backgroundMode: "color",
        backgroundColorMode: "manual",
        backgroundColor: "#f3e7c9",
        backgroundColorSequenceRef: null,
        backgroundImageSource: "",
        borderWidthRatio: 0.03,
        borderColorMode: "manual",
        borderColor: "#000000",
        borderColorSequenceRef: null
      },
      textDefaults: {
        fontFamily: "Times New Roman",
        fontWeight: "700",
        colorMode: "manual",
        color: "#ffffff",
        colorSequenceRef: null,
        textBorder: {
          width: 3,
          colorMode: "manual",
          color: "#000000",
          colorSequenceRef: null
        }
      }
    },
    sequences: {
      text: [],
      color: []
    },
    tokens: [
      {
        id: "token_imported",
        name: "Imported Token",
        diameterIn: 1,
        front: {
          backgroundMode: "color",
          backgroundColorMode: "manual",
          backgroundColor: "#ffffff",
          backgroundColorSequenceRef: null,
          backgroundImageSource: "",
          border: {
            enabled: true,
            widthRatio: 0.03,
            colorMode: "manual",
            color: "#000000",
            colorSequenceRef: null
          },
          images: [
            {
              id: "image_imported",
              name: "dagger.svg",
              x: 0,
              y: 0,
              scale: 0.5,
              aspectRatio: 1,
              rotationDeg: 0,
              mirrorX: false,
              mirrorY: false,
              zIndex: 1,
              source: "data:image/svg+xml;base64," + Buffer.from(paddedSvg).toString("base64")
            }
          ],
          texts: []
        }
      }
    ],
    printSelections: []
  };

  await page.locator("[data-import-input]").setInputFiles({
    name: "imported.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importedProject))
  });

  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Imported Token");
  await page.locator('select[name="selectedComponentKey"]').selectOption({ label: "dagger.svg" });
  const importedImage = page.locator('[data-preview-stage] svg g[data-component-type="image"] image').first();
  await expect(importedImage).toHaveAttribute("href", /data:image\/(png|webp);base64,/);
  const importedDimensions = await importedImage.evaluate((node) => ({
    width: Number(node.getAttribute("width") || 0),
    height: Number(node.getAttribute("height") || 0)
  }));
  expect(importedDimensions.width).toBeLessThan(importedDimensions.height);

  await page.reload();
  await expect(page.locator('select[name="selectedTokenId"]')).toHaveValue("token_imported");
  await expect(page.locator('select[name="selectedComponentKey"]')).toHaveValue("image:image_imported");
  await page.locator('select[name="selectedComponentKey"]').selectOption("");
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Imported Token");
});

test("json import accepts compact asset references", async ({ page }) => {
  const paddedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">' +
    '<rect x="120" y="40" width="60" height="220" fill="red"/>' +
    '</svg>';
  const sharedSource = "data:image/svg+xml;base64," + Buffer.from(paddedSvg).toString("base64");
  const compactProject = {
    version: 1,
    meta: {
      name: "Imported Compact",
      updatedAt: "2026-03-17T00:00:00.000Z"
    },
    settings: {
      pagePresetId: "letter",
      pageOrientation: "portrait",
      pageMarginIn: 0.25,
      cutlineGapMm: 0,
      tokenDefaults: {
        diameterIn: 1,
        backgroundMode: "image",
        backgroundColorMode: "manual",
        backgroundColor: "#f3e7c9",
        backgroundColorSequenceRef: null,
        backgroundImageSource: { assetRef: "image_1" },
        borderWidthRatio: 0.03,
        borderColorMode: "manual",
        borderColor: "#000000",
        borderColorSequenceRef: null
      },
      textDefaults: {
        fontFamily: "Times New Roman",
        fontWeight: "700",
        colorMode: "manual",
        color: "#ffffff",
        colorSequenceRef: null,
        textBorder: {
          width: 3,
          colorMode: "manual",
          color: "#000000",
          colorSequenceRef: null
        }
      }
    },
    sequences: {
      text: [],
      color: []
    },
    tokens: [
      {
        id: "token_compact",
        name: "Imported Compact Token",
        diameterIn: 1,
        front: {
          backgroundMode: "image",
          backgroundColorMode: "manual",
          backgroundColor: "#ffffff",
          backgroundColorSequenceRef: null,
          backgroundImageSource: { assetRef: "image_1" },
          border: {
            enabled: true,
            widthRatio: 0.03,
            colorMode: "manual",
            color: "#000000",
            colorSequenceRef: null
          },
          images: [
            {
              id: "image_imported_compact",
              name: "shared.svg",
              x: 0,
              y: 0,
              scale: 0.5,
              aspectRatio: 1,
              rotationDeg: 0,
              mirrorX: false,
              mirrorY: false,
              zIndex: 1,
              source: { assetRef: "image_1" }
            }
          ],
          texts: []
        }
      }
    ],
    printSelections: [],
    assets: {
      images: [
        {
          id: "image_1",
          source: sharedSource
        }
      ]
    }
  };

  await page.locator("[data-import-input]").setInputFiles({
    name: "imported-compact.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(compactProject))
  });

  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Imported Compact Token");
  await page.locator('select[name="selectedComponentKey"]').selectOption({ label: "shared.svg" });
  const importedImage = page.locator('[data-preview-stage] svg g[data-component-type="image"] image').first();
  await expect(importedImage).toHaveAttribute("href", /data:image\/(png|webp);base64,/);
  const importedBackground = page.locator('[data-preview-stage] svg image[data-background-image="true"]').first();
  await expect(importedBackground).toHaveAttribute("href", /data:image\/(png|webp);base64,/);
});

test("latest example action imports the latest released sample project", async ({ page }) => {
  const dialogMessages = [];
  page.on("dialog", (dialog) => {
    dialogMessages.push(dialog.message());
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Load Latest Example" }).click();

  await expect(page.locator('select[name="selectedTokenId"]')).toHaveValue(/token_/);
  await expect(page.locator('select[name="selectedTokenId"] option')).toContainText(["Sword (1\")"]);
  await expect(page.locator('form[data-form="token-settings"] input[name="name"]')).toHaveValue("Sword");
  await expect(page.locator('[data-preview-stage] svg image[data-background-image="true"]')).toHaveCount(1);
  expect(dialogMessages).not.toContain("Loading the bundled example failed. Please try again later or import the example JSON manually.");
});

test("save failures are surfaced in the header", async ({ page }) => {
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function patchedPut() {
      throw new Error("Quota exceeded");
    };
    globalThis.__restoreIndexedDbPut = () => {
      IDBObjectStore.prototype.put = originalPut;
    };
  });

  await page.getByRole("button", { name: "Create Token" }).click();
  await expect(page.locator("[data-save-status]")).toContainText("could not be saved to browser storage");

  await page.evaluate(() => {
    if (typeof globalThis.__restoreIndexedDbPut === "function") {
      globalThis.__restoreIndexedDbPut();
      delete globalThis.__restoreIndexedDbPut;
    }
  });
});
