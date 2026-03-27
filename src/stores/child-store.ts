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
}

export const useChildStore = create<ChildState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      selectChild: (id) => set({ selectedChildId: id }),
    }),
    {
      name: 'child-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

export const useSelectedChildId = () => useChildStore((s) => s.selectedChildId);
