import type { ArrowElement } from '@rough/schema';
import { snapAngle } from '@rough/shared';
import { createArrow } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import {
  createBinding,
  findBindingTarget,
} from '../../interactions/arrowBinding.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class ArrowTool implements Tool {
  readonly name = 'arrow';
  private start: { x: number; y: number } | null = null;
  private preview: ArrowElement | null = null;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.start = { ...e.world };
    const defaults = this.ctx.getElementDefaults();
    const threshold = 12 / this.ctx.viewport.zoom;
    const startBind = findBindingTarget(
      this.ctx.sceneGraph,
      e.world,
      threshold,
      new Set(),
    );
    const binding = startBind ? createBinding(startBind.elementId, startBind.anchor) : null;
    this.preview = createArrow(
      e.world.x,
      e.world.y,
      e.world.x,
      e.world.y,
      defaults,
      binding,
      null,
    );
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.start || !this.preview) return;
    let endX = e.world.x;
    let endY = e.world.y;
    if (e.shiftKey) {
      const snapped = snapAngle(endX - this.start.x, endY - this.start.y);
      endX = this.start.x + snapped.x;
      endY = this.start.y + snapped.y;
    }
    const updated = createArrow(
      this.start.x,
      this.start.y,
      endX,
      endY,
      {
        roughness: this.preview.roughness,
        roughSeed: this.preview.roughSeed,
        sortKey: this.preview.sortKey,
      },
      this.preview.startBinding,
      null,
    );
    updated.id = this.preview.id;
    this.preview = updated;
    this.ctx.document.setElement(updated);
    this.ctx.rebuildScene();
  }

  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.preview || !this.start) return;
    const threshold = 12 / this.ctx.viewport.zoom;
    const endBind = findBindingTarget(
      this.ctx.sceneGraph,
      e.world,
      threshold,
      new Set([this.preview.id]),
    );
    let el = this.preview;
    if (endBind) {
      el = { ...el, endBinding: createBinding(endBind.elementId, endBind.anchor) };
    }
    this.ctx.document.removeElement(el.id);
    this.ctx.runCommand(new AddElementCommand(this.ctx.document, el));
    this.preview = null;
    this.start = null;
    this.ctx.switchTool('select');
  }

  onKeyDown(): boolean {
    return false;
  }

  cancel(): void {
    if (this.preview) {
      this.ctx.document.removeElement(this.preview.id);
      this.ctx.rebuildScene();
    }
    this.preview = null;
    this.start = null;
  }
}
