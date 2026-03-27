const store = new Map<string, string>();

export function createMMKV(_config?: { id?: string }) {
  return {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => store.set(key, value),
    remove: (key: string) => store.delete(key),
    contains: (key: string) => store.has(key),
    getAllKeys: () => Array.from(store.keys()),
    clearAll: () => store.clear(),
  };
}

export type MMKV = ReturnType<typeof createMMKV>;
