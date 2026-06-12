import { test, expect } from '@playwright/test';
import { dragCanvas, waitForCanvas } from '../helpers/canvas';

test.describe('性能回归', () => {
  test('1000 元素场景下拖拽可在预算内完成', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await waitForCanvas(page);

    const count = await page.evaluate(() => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        AddElementCommand: typeof import('@rough/editor').AddElementCommand;
        createRectangle: typeof import('@rough/editor').createRectangle;
      } }).__ROUGH_E2E__;
      if (!bridge) return 0;
      const { editor, AddElementCommand, createRectangle } = bridge;
      for (let i = 0; i < 1000; i++) {
        const col = i % 40;
        const row = Math.floor(i / 40);
        const rect = createRectangle(col * 24, row * 20, 20, 16, {
          roughness: 0,
          roughSeed: i,
          sortKey: `p${i}`,
        });
        new AddElementCommand(editor.document, rect).execute();
      }
      return Object.keys(editor.document.getElements()).length;
    });

    expect(count).toBe(1000);

    const t0 = Date.now();
    await dragCanvas(page, { x: 150, y: 150 }, { x: 450, y: 150 });
    const elapsed = Date.now() - t0;

    const fps = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (): void => {
          frames++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      });
    });

    expect(elapsed).toBeLessThan(2500);
    expect(fps).toBeGreaterThanOrEqual(55);
  });
});
