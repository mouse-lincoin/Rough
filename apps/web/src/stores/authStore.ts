import { create } from 'zustand';
import { devLogin, getMe, logout, type ApiUser } from '../api/client';
import {
  migrateUnsyncedDocuments,
  type DocumentMigration,
  type MigrationFailure,
} from '../services/cloudSync';
import { useEditorStore } from './editorStore';

interface AuthStore {
  user: ApiUser | null;
  loading: boolean;
  initialized: boolean;
  lastMigrations: DocumentMigration[];
  lastMigrationFailures: MigrationFailure[];
  init: () => Promise<void>;
  login: (name?: string) => Promise<DocumentMigration[]>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  lastMigrations: [],
  lastMigrationFailures: [],

  init: async () => {
    set({ loading: true });
    try {
      const user = await getMe();
      if (user) {
        const { migrations, failures } = await migrateUnsyncedDocuments();
        if (failures.length > 0) {
          useEditorStore
            .getState()
            .showToast(`${failures.length} 个文档同步失败，其余已继续`);
        }
        set({
          user,
          lastMigrations: migrations,
          lastMigrationFailures: failures,
          loading: false,
          initialized: true,
        });
      } else {
        set({ user: null, loading: false, initialized: true });
      }
    } catch {
      set({ user: null, loading: false, initialized: true });
    }
  },

  login: async (name = '本地用户') => {
    const user = await devLogin(name);
    set({ user });
    const { migrations, failures } = await migrateUnsyncedDocuments();
    if (failures.length > 0) {
      useEditorStore.getState().showToast(`${failures.length} 个文档同步失败`);
    }
    set({ lastMigrations: migrations, lastMigrationFailures: failures });
    return migrations;
  },

  signOut: async () => {
    await logout();
    set({ user: null, lastMigrations: [] });
  },
}));
