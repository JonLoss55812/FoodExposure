import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'child-storage' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.remove(name),
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
