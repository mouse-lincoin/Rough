import { test, expect } from '@playwright/test';

const COLLAB_URL = process.env.VITE_COLLAB_URL ?? 'ws://127.0.0.1:3099';

test.describe('§13.2 用例 4 — 双浏览器协作', () => {
  test('A 画图 B 可见、光标互见、A undo 不影响 B', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto('/');
    await pageA.getByTestId('create-doc').click();
    await pageA.waitForURL(/\/doc\/([^/]+)/);
    const docUrl = pageA.url();
    const docId = docUrl.match(/\/doc\/([^/]+)/)?.[1];
    expect(docId).toBeTruthy();

    await pageA.waitForSelector('[data-testid="canvas-host"]');
    await pageB.goto(docUrl);
    await pageB.waitForSelector('[data-testid="canvas-host"]');

    const connect = async (
      page: import('@playwright/test').Page,
      user: { id: string; name: string },
    ): Promise<void> => {
      const synced = await page.evaluate(
        async ({ collabUrl, id, userInfo }) => {
          const bridge = (window as unknown as { __ROUGH_E2E__?: {
            editor: import('@rough/editor').Editor;
            waitForCollabSynced: (timeoutMs?: number) => Promise<boolean>;
          } }).__ROUGH_E2E__;
          if (!bridge) return false;
          const { editor, waitForCollabSynced } = bridge;
          editor.connectCollab({
            url: collabUrl,
            documentId: id,
            token: 'e2e',
            user: userInfo,
          });
          return waitForCollabSynced(15_000);
        },
        { collabUrl: COLLAB_URL, id: docId, userInfo: user },
      );
      expect(synced).toBe(true);
    };

    await connect(pageA, { id: 'user-a', name: 'Alice' });
    await connect(pageB, { id: 'user-b', name: 'Bob' });

    const aRectId = await pageA.evaluate(async () => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        AddElementCommand: typeof import('@rough/editor').AddElementCommand;
        createRectangle: typeof import('@rough/editor').createRectangle;
      } }).__ROUGH_E2E__;
      if (!bridge) return null;
      const { editor, AddElementCommand, createRectangle } = bridge;
      const rect = createRectangle(40, 40, 100, 80, {
        roughness: 1,
        roughSeed: 1,
        sortKey: 'a0',
      });
      new AddElementCommand(editor.document, rect).execute();
      return rect.id;
    });
    expect(aRectId).toBeTruthy();

    await expect
      .poll(
        async () =>
          pageB.evaluate(() => {
            const editor = (window as unknown as {
              __ROUGH_EDITOR__?: { document: { getElements: () => Record<string, unknown> } };
            }).__ROUGH_EDITOR__;
            return editor ? Object.keys(editor.document.getElements()).length : 0;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    await pageA.evaluate(() => {
      const editor = (window as unknown as { __ROUGH_EDITOR__?: import('@rough/editor').Editor })
        .__ROUGH_EDITOR__;
      editor?.publishPointer({ x: 120, y: 80 });
    });

    await expect
      .poll(
        async () =>
          pageB.evaluate(() => {
            const editor = (window as unknown as {
              __ROUGH_EDITOR__?: {
                document: {
                  getCollabAwareness: () => { getStates: () => Map<number, { cursor?: unknown }> } | null;
                };
              };
            }).__ROUGH_EDITOR__;
            const awareness = editor?.document.getCollabAwareness();
            if (!awareness) return 0;
            let peers = 0;
            awareness.getStates().forEach((state, clientId) => {
              if (clientId !== awareness.clientID && state?.cursor) peers += 1;
            });
            return peers;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    const bRectId = await pageB.evaluate(async () => {
      const bridge = (window as unknown as { __ROUGH_E2E__?: {
        editor: import('@rough/editor').Editor;
        AddElementCommand: typeof import('@rough/editor').AddElementCommand;
        createRectangle: typeof import('@rough/editor').createRectangle;
      } }).__ROUGH_E2E__;
      if (!bridge) return null;
      const { editor, AddElementCommand, createRectangle } = bridge;
      const rect = createRectangle(200, 200, 80, 60, {
        roughness: 1,
        roughSeed: 2,
        sortKey: 'b0',
      });
      new AddElementCommand(editor.document, rect).execute();
      return rect.id;
    });
    expect(bRectId).toBeTruthy();

    await expect
      .poll(
        async () =>
          pageA.evaluate((id) => {
            const editor = (window as unknown as {
              __ROUGH_EDITOR__?: { document: { getElement: (id: string) => unknown } };
            }).__ROUGH_EDITOR__;
            return editor?.document.getElement(id) != null;
          }, bRectId!),
        { timeout: 10_000 },
      )
      .toBe(true);

    await pageA.evaluate(() => {
      const editor = (window as unknown as {
        __ROUGH_EDITOR__?: { document: { undo: { undo: () => void } } };
      }).__ROUGH_EDITOR__;
      editor?.document.undo.undo();
    });

    const afterUndo = await pageA.evaluate((ids) => {
      const editor = (window as unknown as {
        __ROUGH_EDITOR__?: { document: { getElement: (id: string) => unknown } };
      }).__ROUGH_EDITOR__;
      if (!editor) return { aGone: false, bPresent: false };
      return {
        aGone: editor.document.getElement(ids.aId) == null,
        bPresent: editor.document.getElement(ids.bId) != null,
      };
    }, { aId: aRectId!, bId: bRectId! });

    expect(afterUndo.aGone).toBe(true);
    expect(afterUndo.bPresent).toBe(true);

    await contextA.close();
    await contextB.close();
  });
});
