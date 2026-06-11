export { Editor } from './Editor.js';
export type { EditorOptions } from './Editor.js';
export type { ToolName, EditorCallbacks, ExportContext, CommentPin } from './types.js';
export {
  computeAnchorDegradations,
  resolveCommentAnchorWorld,
  worldToElementLocal,
  type CommentAnchorDegrade,
} from './comments/commentAnchors.js';
export { SceneGraph } from './scene/SceneGraph.js';
export { matApply, elementLocalMatrix } from './scene/transforms.js';
export { getWorldAABB, getRotatedWorldCorners } from './scene/bounds.js';
export {
  getHandlePositions,
  hitTestHandle,
  applyResize,
  worldDeltaToElementLocal,
  type HandleType,
} from './interactions/transformHandles.js';
export { hitTestPoint } from './interactions/hitTest.js';
export { ROUGH_CLIPBOARD_MIME } from './clipboard/clipboard.js';
export type { AlignType } from './interactions/align.js';
export { solveLayout, applyLayoutToDocument } from './layout/autoLayout.js';
export { parseShadowId, shadowId } from './components/instanceExpansion.js';
export { AddElementCommand, UpdateElementsCommand } from './commands/ElementCommands.js';
export {
  createRectangle,
  createFrame,
  createArrow,
} from './document/elementFactory.js';
export {
  CreateComponentCommand,
  InstantiateComponentCommand,
  DetachInstanceCommand,
  UpdateComponentCommand,
  UpdateInstanceOverrideCommand,
  ApplyAutoLayoutCommand,
} from './commands/componentCommands.js';
