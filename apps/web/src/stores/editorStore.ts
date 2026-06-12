import { create } from 'zustand';
import type { ID } from '@rough/schema';
import type { CollabConnectionStatus, RemotePeer, ToolName } from '@rough/editor';

interface EditorStore {
  activeTool: ToolName;
  cleanMode: boolean;
  selectedIds: ID[];
  documentVersion: number;
  currentPageId: ID | null;
  panelsVisible: boolean;
  toastMessage: string | null;
  collabStatus: CollabConnectionStatus;
  remotePeers: RemotePeer[];
  followingClientId: number | null;
  setActiveTool: (tool: ToolName) => void;
  setCleanMode: (clean: boolean) => void;
  setSelectedIds: (ids: ID[]) => void;
  bumpDocumentVersion: () => void;
  setCurrentPageId: (id: ID) => void;
  setPanelsVisible: (visible: boolean) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  setCollabStatus: (status: CollabConnectionStatus) => void;
  setRemotePeers: (peers: RemotePeer[]) => void;
  setFollowingClientId: (clientId: number | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeTool: 'select',
  cleanMode: false,
  selectedIds: [],
  documentVersion: 0,
  currentPageId: null,
  panelsVisible: true,
  toastMessage: null,
  collabStatus: 'idle',
  remotePeers: [],
  followingClientId: null,
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
  setCollabStatus: (status) => set({ collabStatus: status }),
  setRemotePeers: (peers) => set({ remotePeers: peers }),
  setFollowingClientId: (clientId) => set({ followingClientId: clientId }),
}));
