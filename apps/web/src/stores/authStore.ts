import { create } from 'zustand';
import { devLogin, getMe, logout, type ApiUser } from '../api/client';
import { migrateUnsyncedDocuments, type DocumentMigration } from '../services/cloudSync';

interface AuthStore {
  user: ApiUser | null;
  loading: boolean;
  initialized: boolean;
  lastMigrations: DocumentMigration[];
  init: () => Promise<void>;
  login: (name?: string) => Promise<DocumentMigration[]>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  lastMigrations: [],

  init: async () => {
    set({ loading: true });
    try {
      const user = await getMe();
      if (user) {
        const migrations = await migrateUnsyncedDocuments();
        set({ user, lastMigrations: migrations, loading: false, initialized: true });
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
    const migrations = await migrateUnsyncedDocuments();
    set({ lastMigrations: migrations });
    return migrations;
  },

  signOut: async () => {
    await logout();
    set({ user: null, lastMigrations: [] });
  },
}));
