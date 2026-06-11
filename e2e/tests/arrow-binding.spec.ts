import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 2 — 箭头吸附', () => {
  test('移动框时箭头跟随', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('[data-testid="canvas-host"]');

    const ok = await page.evaluate(async () => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        AddElementCommand: typeof import('@rough/editor').AddElementCommand;
        createRectangle: typeof import('@rough/editor').createRectangle;
        createArrow: typeof import('@rough/editor').createArrow;
        UpdateElementsCommand: typeof import('@rough/editor').UpdateElementsCommand;
      } }).__ROUGH_E2E__;
      if (!bridge) return false;
      const { editor, AddElementCommand, createRectangle, createArrow, UpdateElementsCommand } = bridge;
      const defaults = { roughness: 1, roughSeed: 1, sortKey: 'a0' };
      const a = createRectangle(50, 50, 80, 60, { ...defaults, sortKey: 'a0' });
      const b = createRectangle(250, 50, 80, 60, { ...defaults, sortKey: 'a1' });
      new AddElementCommand(editor.document, a).execute();
      new AddElementCommand(editor.document, b).execute();
      const arrow = createArrow(
        130,
        80,
        250,
        80,
        { ...defaults, sortKey: 'a2' },
        { elementId: a.id, anchor: 'right' as const, offset: { x: 0, y: 0 } },
        { elementId: b.id, anchor: 'left' as const, offset: { x: 0, y: 0 } },
      );
      new AddElementCommand(editor.document, arrow).execute();
      editor.sceneGraph.rebuild(editor.document.getElements(), editor.document.getComponents());

      new UpdateElementsCommand(editor.document, [{ ...a, x: 100, y: 100 }]).execute();

      const updated = editor.document.getElements()[arrow.id];
      return updated?.type === 'arrow' && updated.points[0].x !== 130;
    });

    expect(ok).toBe(true);
  });
});
