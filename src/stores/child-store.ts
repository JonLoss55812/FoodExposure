import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'child-storage' });

const mmkvStorage = {
  getItem: (name: string) => {
    try {
      return storage.getString(name) ?? null;
    } catch (err) {
      console.error('child-store MMKV getItem failed:', err);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      storage.set(name, value);
    } catch (err) {
      console.error('child-store MMKV setItem failed:', err);
    }
  },
  removeItem: (name: string) => {
    try {
      storage.remove(name);
    } catch (err) {
      console.error('child-store MMKV removeItem failed:', err);
    }
  },
};

interface ChildState {
  selectedChildId: string | null;
  selectChild: (id: string) => void;
  ensureSelection: (children: ReadonlyArray<{ id: string }>) => void;
}

export const useChildStore = create<ChildState>()(
  persist(
    (set, get) => ({
      selectedChildId: null,
      selectChild: (id) => set({ selectedChildId: id }),
      ensureSelection: (children) => {
        const current = get().selectedChildId;
        if (children.length === 0) {
          if (current !== null) set({ selectedChildId: null });
          return;
        }
        const isValid = current !== null && children.some((c) => c.id === current);
        if (!isValid) set({ selectedChildId: children[0].id });
      },
    }),
    {
      name: 'child-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

export const useSelectedChildId = () => useChildStore((s) => s.selectedChildId);
