import type { EditorContext } from '../EditorContext.js';
import type { NormalizedPointerEvent, ToolName } from '../types.js';
import type { ToolManager } from './ToolManager.js';

export class InputPipeline {
  private spaceHeld = false;
  private tempHand = false;
  private pointerDown = false;
  private lastClickTime = 0;
  private lastClickWorld = { x: 0, y: 0 };

  constructor(
    _container: HTMLElement,
    private canvas: HTMLCanvasElement,
    private ctx: EditorContext,
    private tools: ToolManager,
    private onToolChange: (tool: ToolName) => void,
  ) {
    this.bind();
  }

  private bind(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private normalize(e: PointerEvent): NormalizedPointerEvent {
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = this.ctx.viewport.screenToWorld(screen);
    return {
      type: e.type as NormalizedPointerEvent['type'],
      world,
      screen,
      button: e.button,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      pointerId: e.pointerId,
      originalEvent: e,
    };
  }

  private getEffectiveTool(): import('./tools/BaseTool.js').Tool {
    if (this.spaceHeld || this.tempHand) {
      return this.tools.getTool('hand')!;
    }
    return this.tools.activeTool;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const normalized = this.normalize(e);
    const now = Date.now();
    const isDoubleClick =
      now - this.lastClickTime < 300 &&
      Math.hypot(normalized.world.x - this.lastClickWorld.x, normalized.world.y - this.lastClickWorld.y) < 5;
    this.lastClickTime = now;
    this.lastClickWorld = normalized.world;

    if (isDoubleClick && this.tools.activeTool.name === 'select') {
      this.tools.selectTool.onDoubleClick(normalized);
      return;
    }

    this.pointerDown = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.getEffectiveTool().onPointerDown(normalized);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.getEffectiveTool().onPointerMove(this.normalize(e));
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    this.getEffectiveTool().onPointerUp(this.normalize(e));
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.ctx.viewport.zoomAt(screen, factor);
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      this.ctx.viewport.pan(-dx, -dy);
    }
    this.ctx.markSceneDirty();
    this.ctx.requestRender();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === ' ' && !this.spaceHeld) {
      this.spaceHeld = true;
      e.preventDefault();
      return;
    }

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (this.ctx.document.undo.undo()) {
        this.ctx.rebuildScene();
        this.ctx.requestRender();
      }
      return;
    }

    if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (this.ctx.document.undo.redo()) {
        this.ctx.rebuildScene();
        this.ctx.requestRender();
      }
      return;
    }

    const toolKeys: Record<string, ToolName> = {
      v: 'select',
      V: 'select',
      Escape: 'select',
      h: 'hand',
      H: 'hand',
      r: 'rectangle',
      R: 'rectangle',
      o: 'ellipse',
      O: 'ellipse',
      l: 'line',
      L: 'line',
      p: 'pen',
      P: 'pen',
      f: 'frame',
      F: 'frame',
      t: 'text',
      T: 'text',
    };

    if (!mod && toolKeys[e.key]) {
      this.tools.setTool(toolKeys[e.key]);
      this.onToolChange(this.tools.activeToolName);
      return;
    }

    this.tools.activeTool.onKeyDown(e);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ') {
      this.spaceHeld = false;
    }
  };
}
