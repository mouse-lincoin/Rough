import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 5 — 组件与线框库', () => {
  test('拖入 navbar 组件后可编辑文字', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
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

    const syncOk = await page.evaluate(() => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        createKitComponent: typeof import('@rough/wireframe-kit').createKitComponent;
        UpdateInstanceOverrideCommand: typeof import('@rough/editor').UpdateInstanceOverrideCommand;
        UpdateComponentCommand: typeof import('@rough/editor').UpdateComponentCommand;
        shadowId: typeof import('@rough/editor').shadowId;
      } }).__ROUGH_E2E__;
      if (!bridge) return false;

      const {
        editor,
        createKitComponent,
        UpdateInstanceOverrideCommand,
        UpdateComponentCommand,
        shadowId,
      } = bridge;
      const navbar = createKitComponent('navbar');
      const i1 = editor.instantiateComponentAt(navbar, 300, 100);
      if (!i1) return false;
      const el1 = editor.document.getElements()[i1];
      if (!el1 || el1.type !== 'instance') return false;
      const comp = editor.document.getComponents()[el1.componentId];
      if (!comp) return false;
      const i2 = editor.instantiateComponentAt(comp, 500, 100);
      if (!i2) return false;
      const logoId = Object.entries(comp.elements).find(([, e]) => e.type === 'text')?.[0];
      if (!logoId) return false;

      const store = editor.document;
      new UpdateInstanceOverrideCommand(store, i1, logoId, { text: 'OVERRIDE' }).execute();
      const logo = { ...comp.elements[logoId], text: 'MASTER' } as import('@rough/schema').TextElement;
      new UpdateComponentCommand(store, comp.id, [logo]).execute();

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
