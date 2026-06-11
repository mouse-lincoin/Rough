import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 1 — 持久化与撤销', () => {
  test('画矩形 → 改色 → undo/redo → 刷新后仍在', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('[data-testid="canvas-host"]');

    const created = await page.evaluate(async () => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        AddElementCommand: typeof import('@rough/editor').AddElementCommand;
        createRectangle: typeof import('@rough/editor').createRectangle;
        UpdateElementsCommand: typeof import('@rough/editor').UpdateElementsCommand;
      } }).__ROUGH_E2E__;
      if (!bridge) return false;
      const { editor, AddElementCommand, createRectangle, UpdateElementsCommand } = bridge;
      const defaults = { roughness: 1, roughSeed: 1, sortKey: 'a0' };
      const rect = createRectangle(80, 80, 120, 80, defaults);
      new AddElementCommand(editor.document, rect).execute();
      new UpdateElementsCommand(editor.document, [
        { ...rect, fills: [{ type: 'solid', color: { r: 200, g: 50, b: 50, a: 1 } }] },
      ]).execute();
      editor.document.undo.undo();
      editor.document.undo.redo();
      return Object.keys(editor.document.getElements()).length > 0;
    });
    expect(created).toBe(true);

    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-testid="canvas-host"]');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const editor = (window as unknown as {
              __ROUGH_EDITOR__?: { document: { getElements: () => Record<string, unknown> } };
            }).__ROUGH_EDITOR__;
            return editor ? Object.keys(editor.document.getElements()).length : 0;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  });
});
