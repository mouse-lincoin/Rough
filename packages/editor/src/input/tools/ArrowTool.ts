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
import type { ID } from '@rough/schema';
import type { Tool } from './BaseTool.js';
import type { EditorHost } from '../../EditorContext.js';

export class ArrowTool implements Tool {
  readonly name = 'arrow';
  private start: { x: number; y: number } | null = null;
  private preview: ArrowElement | null = null;

  constructor(
    private ctx: EditorContext,
    private host?: EditorHost & { setBindingTarget?: (elementId: ID | null) => void },
  ) {}

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
      'orthogonal',
    );
    this.host?.setBindingTarget?.(startBind?.elementId ?? null);
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
    const threshold = 12 / this.ctx.viewport.zoom;
    const endBindPreview = findBindingTarget(
      this.ctx.sceneGraph,
      { x: endX, y: endY },
      threshold,
      new Set([this.preview.id]),
    );
    this.host?.setBindingTarget?.(endBindPreview?.elementId ?? null);

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
      this.preview.routing,
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
    this.host?.setBindingTarget?.(null);
    this.ctx.switchTool('select');
  }

  onKeyDown(): boolean {
    return false;
  }

  cancel(): void {
    this.host?.setBindingTarget?.(null);
    if (this.preview) {
      this.ctx.document.removeElement(this.preview.id);
      this.ctx.rebuildScene();
    }
    this.preview = null;
    this.start = null;
  }
}
