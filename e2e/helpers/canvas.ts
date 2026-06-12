import type { Page } from '@playwright/test';

export async function waitForCanvas(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="canvas-host"]');
}

export async function getCanvasBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('[data-testid="canvas-host"]').boundingBox();
  if (!box) throw new Error('Canvas not found');
  return box;
}

export async function clickCanvasAt(
  page: Page,
  offsetX: number,
  offsetY: number,
): Promise<void> {
  const box = await getCanvasBox(page);
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
}

export async function dragCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const box = await getCanvasBox(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
}
