import { test, expect } from '@playwright/test';
import { dragCanvas, waitForCanvas } from '../helpers/canvas';

test.describe('真实键鼠 — 矩形绘制', () => {
  test('工具栏矩形 + 画布拖拽创建元素', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await waitForCanvas(page);

    await page.getByTestId('tool-rectangle').click();
    await dragCanvas(page, { x: 120, y: 120 }, { x: 260, y: 200 });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const editor = (window as unknown as {
              __ROUGH_EDITOR__?: { document: { getElements: () => Record<string, unknown> } };
            }).__ROUGH_EDITOR__;
            return editor ? Object.keys(editor.document.getElements()).length : 0;
          }),
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
  });
});
