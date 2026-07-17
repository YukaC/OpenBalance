/**
 * Minimal browser globals for Node tests that import Zustand persist stores.
 */
const memory = new Map();

const localStorageMock = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(String(key), String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  },
  key(index) {
    return [...memory.keys()][index] ?? null;
  },
  get length() {
    return memory.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
