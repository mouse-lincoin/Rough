import { create } from 'zustand';
import type { ToolName } from '@rough/editor';

interface EditorStore {
  activeTool: ToolName;
  cleanMode: boolean;
  setActiveTool: (tool: ToolName) => void;
  setCleanMode: (clean: boolean) => void;
  editorRef: { current: import('@rough/editor').Editor | null };
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeTool: 'select',
  cleanMode: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCleanMode: (clean) => set({ cleanMode: clean }),
  editorRef: { current: null },
}));
