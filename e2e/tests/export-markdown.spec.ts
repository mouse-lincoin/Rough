import { test, expect } from '@playwright/test';

test.describe('§13.2 用例 3 — 线框组件导出 Markdown', () => {
  test('拖入 navbar 后 Markdown 结构正确', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('create-doc').click();
    await page.waitForURL(/\/doc\//);
    await page.waitForSelector('[data-testid="canvas-host"]');

    const md = await page.evaluate(() => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        createKitComponent: typeof import('@rough/wireframe-kit').createKitComponent;
        shadowId: typeof import('@rough/editor').shadowId;
      } }).__ROUGH_E2E__;
      if (!bridge) return '';
      const { editor, createKitComponent, shadowId } = bridge;
      const navbar = createKitComponent('navbar');
      const instanceId = editor.instantiateComponentAt(navbar, 0, 0);
      if (!instanceId) return '';
      const instance = editor.document.getElements()[instanceId];
      if (!instance || instance.type !== 'instance') return '';
      const comp = editor.document.getComponents()[instance.componentId];
      if (!comp) return '';
      const rootFrameId = shadowId(instanceId, comp.rootId);
      return editor.getMarkdownExport([rootFrameId]);
    });

    expect(md).toContain('# Page:');
    expect(md).toContain('Rough');
    expect(md).toContain('首页');
  });
});
