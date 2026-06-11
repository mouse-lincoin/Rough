import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 6 — 旋转后 resize', () => {
  test('旋转矩形 resize 算法在浏览器内生效', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('.canvas-main');

    const width = await page.evaluate(async () => {
      const bridge = (window as unknown as {
        __ROUGH_E2E__?: {
          editor: import('@rough/editor').Editor;
          AddElementCommand: typeof import('@rough/editor').AddElementCommand;
          createRectangle: typeof import('@rough/editor').createRectangle;
          UpdateElementsCommand: typeof import('@rough/editor').UpdateElementsCommand;
          applyRotatedResize: (
            id: string,
            handle: 'e',
            dx: number,
            dy: number,
          ) => { width: number } | null;
        };
      }).__ROUGH_E2E__;
      if (!bridge) return 0;
      const { editor, AddElementCommand, createRectangle, UpdateElementsCommand, applyRotatedResize } =
        bridge;
      const defaults = { roughness: 1, roughSeed: 1, sortKey: 'a0' };
      const rect = createRectangle(120, 120, 100, 50, defaults);
      new AddElementCommand(editor.document, rect).execute();
      new UpdateElementsCommand(editor.document, [{ ...rect, rotation: Math.PI / 4 }]).execute();
      editor.sceneGraph.rebuild(editor.document.getElements(), editor.document.getComponents());
      const bounds = applyRotatedResize(rect.id, 'e', 50, 0);
      if (!bounds) return 0;
      new UpdateElementsCommand(editor.document, [{ ...rect, ...bounds }]).execute();
      return editor.document.getElement(rect.id)?.width ?? 0;
    });

    expect(width).toBeGreaterThan(105);
  });

  test('手柄命中与拖拽向量可放大旋转矩形', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('.canvas-main');

    const result = await page.evaluate(async () => {
      const bridge = (window as unknown as {
        __ROUGH_E2E__?: {
          editor: import('@rough/editor').Editor;
          AddElementCommand: typeof import('@rough/editor').AddElementCommand;
          createRectangle: typeof import('@rough/editor').createRectangle;
          UpdateElementsCommand: typeof import('@rough/editor').UpdateElementsCommand;
          getTransformHandleDrag: (
            elementId: string,
            handle: 'e',
            distance: number,
          ) => { start: { x: number; y: number }; end: { x: number; y: number } } | null;
          hitTransformHandle: (elementId: string, p: { x: number; y: number }) => string | null;
          applyRotatedResize: (
            id: string,
            handle: 'e',
            dx: number,
            dy: number,
          ) => { width: number } | null;
        };
      }).__ROUGH_E2E__;
      if (!bridge) return { ok: false as const };

      const { editor, AddElementCommand, createRectangle, UpdateElementsCommand, getTransformHandleDrag, hitTransformHandle, applyRotatedResize } =
        bridge;
      const defaults = { roughness: 1, roughSeed: 1, sortKey: 'a0' };
      const rect = createRectangle(120, 120, 100, 50, defaults);
      new AddElementCommand(editor.document, rect).execute();
      new UpdateElementsCommand(editor.document, [{ ...rect, rotation: Math.PI / 4 }]).execute();
      editor.sceneGraph.rebuild(editor.document.getElements(), editor.document.getComponents());

      const drag = getTransformHandleDrag(rect.id, 'e', 80);
      if (!drag) return { ok: false as const };

      const hit = hitTransformHandle(rect.id, drag.start);
      const startWorld = editor.viewport.screenToWorld(drag.start);
      const endWorld = editor.viewport.screenToWorld(drag.end);
      const bounds = applyRotatedResize(
        rect.id,
        'e',
        endWorld.x - startWorld.x,
        endWorld.y - startWorld.y,
      );
      if (!bounds) return { ok: false as const, hit };
      new UpdateElementsCommand(editor.document, [{ ...rect, ...bounds }]).execute();

      return {
        ok: true as const,
        hit,
        width: editor.document.getElement(rect.id)?.width ?? 0,
      };
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit).toBe('e');
    expect(result.width).toBeGreaterThan(105);
  });
});
