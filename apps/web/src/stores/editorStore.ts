import { create } from 'zustand';
import type { ID } from '@rough/schema';
import type { ToolName } from '@rough/editor';

interface EditorStore {
  activeTool: ToolName;
  cleanMode: boolean;
  selectedIds: ID[];
  documentVersion: number;
  currentPageId: ID | null;
  panelsVisible: boolean;
  toastMessage: string | null;
  setActiveTool: (tool: ToolName) => void;
  setCleanMode: (clean: boolean) => void;
  setSelectedIds: (ids: ID[]) => void;
  bumpDocumentVersion: () => void;
  setCurrentPageId: (id: ID) => void;
  setPanelsVisible: (visible: boolean) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeTool: 'select',
  cleanMode: false,
  selectedIds: [],
  documentVersion: 0,
  currentPageId: null,
  panelsVisible: true,
  toastMessage: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCleanMode: (clean) => set({ cleanMode: clean }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  bumpDocumentVersion: () => set((s) => ({ documentVersion: s.documentVersion + 1 })),
  setCurrentPageId: (id) => set({ currentPageId: id }),
  setPanelsVisible: (visible) => set({ panelsVisible: visible }),
  showToast: (message) => {
    set({ toastMessage: message });
    setTimeout(() => {
      set((s) => (s.toastMessage === message ? { toastMessage: null } : s));
    }, 3000);
  },
  clearToast: () => set({ toastMessage: null }),
}));
