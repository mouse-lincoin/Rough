import type { Editor } from '@rough/editor';
import {
  AddElementCommand,
  UpdateElementsCommand,
  UpdateInstanceOverrideCommand,
  UpdateComponentCommand,
  shadowId,
} from '@rough/editor';
import { createRectangle, createFrame, createArrow } from '@rough/editor';
import { createKitComponent } from '@rough/wireframe-kit';

export function attachE2EBridge(editor: Editor): void {
  (window as unknown as { __ROUGH_E2E__?: Record<string, unknown> }).__ROUGH_E2E__ = {
    AddElementCommand,
    UpdateElementsCommand,
    UpdateInstanceOverrideCommand,
    UpdateComponentCommand,
    createRectangle,
    createFrame,
    createArrow,
    createKitComponent,
    shadowId,
    editor,
    waitForCollabSynced: (timeoutMs?: number) => editor.document.waitForCollabSynced(timeoutMs),
  };
}
