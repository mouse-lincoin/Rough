import type { EditorContext } from '../EditorContext.js';
import type { ToolName } from '../types.js';
import type { Tool } from './tools/BaseTool.js';
import { HandTool } from './tools/HandTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { RectangleTool } from './tools/RectangleTool.js';
import { EllipseTool } from './tools/EllipseTool.js';
import { LineTool } from './tools/LineTool.js';
import { PenTool } from './tools/PenTool.js';
import { FrameTool } from './tools/FrameTool.js';
import { TextTool } from './tools/TextTool.js';
import { PolygonTool } from './tools/PolygonTool.js';
import { ArrowTool } from './tools/ArrowTool.js';
import { CommentTool } from './tools/CommentTool.js';

export class ToolManager {
  private tools: Map<ToolName, Tool>;
  private _activeTool: Tool;
  selectTool: SelectTool;

  constructor(ctx: EditorContext, host?: import('../EditorContext.js').EditorHost & { getGridSnap?: () => boolean; setSnapGuides?: (guides: import('../interactions/snapping.js').SnapGuide[]) => void; placeComment?: (x: number, y: number) => void }) {
    this.selectTool = new SelectTool(ctx, host);
    this.tools = new Map<ToolName, Tool>([
      ['select', this.selectTool],
      ['hand', new HandTool(ctx)],
      ['rectangle', new RectangleTool(ctx)],
      ['ellipse', new EllipseTool(ctx)],
      ['line', new LineTool(ctx)],
      ['pen', new PenTool(ctx)],
      ['frame', new FrameTool(ctx)],
      ['text', new TextTool(ctx)],
      ['polygon', new PolygonTool(ctx)],
      ['arrow', new ArrowTool(ctx)],
      ['comment', new CommentTool(ctx, host as import('../Editor.js').Editor)],
    ]);
    this._activeTool = this.tools.get('select')!;
  }

  get activeTool(): Tool {
    return this._activeTool;
  }

  get activeToolName(): ToolName {
    return this._activeTool.name as ToolName;
  }

  setTool(name: ToolName): void {
    if (this._activeTool.name === name) return;
    this._activeTool.cancel();
    const tool = this.tools.get(name);
    if (!tool) return;
    this._activeTool = tool;
  }

  cancelActive(): void {
    this._activeTool.cancel();
  }

  getTool(name: ToolName): Tool | undefined {
    return this.tools.get(name);
  }
}
