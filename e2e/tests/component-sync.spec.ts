import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 5 — 组件与线框库', () => {
  test('拖入 navbar 组件后可编辑文字', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '新建文档' }).click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('[data-testid="canvas-host"]');

    await page.getByRole('button', { name: 'Navbar' }).click();
    await page.waitForTimeout(300);

    const hasInstance = await page.evaluate(() => {
      const editor = (window as unknown as { __ROUGH_EDITOR__?: { document: { getElements: () => Record<string, { type: string }> } } }).__ROUGH_EDITOR__;
      if (!editor) return false;
      return Object.values(editor.document.getElements()).some((e) => e.type === 'instance');
    });
    expect(hasInstance).toBe(true);

    const syncOk = await page.evaluate(async () => {
      const editor = (window as unknown as {
        __ROUGH_EDITOR__?: {
          document: {
            getElements: () => Record<string, import('@rough/schema').Element>;
            getComponents: () => Record<string, import('@rough/schema').ComponentDef>;
          };
          sceneGraph: import('@rough/editor').SceneGraph;
          instantiateComponentAt: (def: import('@rough/schema').ComponentDef, x: number, y: number) => string | null;
        };
      }).__ROUGH_EDITOR__;
      if (!editor) return false;

      const { createKitComponent } = await import('@rough/wireframe-kit');
      const { UpdateInstanceOverrideCommand, UpdateComponentCommand } = await import('@rough/editor');
      const navbar = createKitComponent('navbar');
      const i1 = editor.instantiateComponentAt(navbar, 300, 100);
      const i2 = editor.instantiateComponentAt(navbar, 500, 100);
      if (!i1 || !i2) return false;

      const el1 = editor.document.getElements()[i1];
      if (!el1 || el1.type !== 'instance') return false;
      const comp = editor.document.getComponents()[el1.componentId];
      if (!comp) return false;
      const logoId = Object.entries(comp.elements).find(([, e]) => e.type === 'text')?.[0];
      if (!logoId) return false;

      const store = (editor as unknown as { document: import('@rough/document').DocumentStore }).document;
      new UpdateInstanceOverrideCommand(store, i1, logoId, { text: 'OVERRIDE' }).execute();
      const logo = { ...comp.elements[logoId], text: 'MASTER' } as import('@rough/schema').TextElement;
      new UpdateComponentCommand(store, comp.id, [logo]).execute();

      editor.sceneGraph.rebuild(store.getElements(), store.getComponents());
      const { shadowId } = await import('@rough/editor');
      const s1 = editor.sceneGraph.getNode(shadowId(i1, logoId));
      const s2 = editor.sceneGraph.getNode(shadowId(i2, logoId));
      return (
        s1?.element.type === 'text' &&
        s1.element.text === 'OVERRIDE' &&
        s2?.element.type === 'text' &&
        s2.element.text === 'MASTER'
      );
    });

    expect(syncOk).toBe(true);
  });
});
