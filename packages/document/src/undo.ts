import * as Y from 'yjs';
import { LOCAL_ORIGIN } from './constants.js';

const CAPTURE_TIMEOUT = 200;

export class DocumentUndoManager {
  private undoManager: Y.UndoManager;

  constructor(ydoc: Y.Doc) {
    this.undoManager = new Y.UndoManager(
      [ydoc.getMap('pages'), ydoc.getMap('components')] as unknown as Y.AbstractType<unknown>[],
      {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
        captureTimeout: CAPTURE_TIMEOUT,
      },
    );
  }

  undo(): boolean {
    if (this.undoManager.undoStack.length === 0) return false;
    this.undoManager.undo();
    return true;
  }

  redo(): boolean {
    if (this.undoManager.redoStack.length === 0) return false;
    this.undoManager.redo();
    return true;
  }

  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }
}
