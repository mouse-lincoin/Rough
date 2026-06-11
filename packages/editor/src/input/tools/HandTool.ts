import type { EditorContext } from '../../EditorContext.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class HandTool implements Tool {
  readonly name = 'hand';
  private dragging = false;
  private lastScreen = { x: 0, y: 0 };

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.dragging = true;
    this.lastScreen = e.screen;
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.dragging) return;
    const dx = e.screen.x - this.lastScreen.x;
    const dy = e.screen.y - this.lastScreen.y;
    this.lastScreen = e.screen;
    this.ctx.viewport.pan(dx, dy);
    this.ctx.markSceneDirty();
    this.ctx.requestRender();
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  onKeyDown(): boolean {
    return false;
  }

  cancel(): void {
    this.dragging = false;
  }
}
