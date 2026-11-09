// Discoveries live only in this page's memory, never in restorable browser storage.

export const TOTAL_BOXES = 100_000;
const LEGACY_KEY = 'foly:session:v1';

export function createSession(storage) {
  const state = { opened: [], history: [] };
  try { storage?.removeItem(LEGACY_KEY); } catch { /* Storage may be blocked. */ }
  return {
    get opened() { return state.opened; },
    get history() { return state.history; },
    record(box, discovery) {
      const entry = { n: state.history.length + 1, box, at: Date.now(), discovery };
      state.opened.push(box);
      state.history.push(entry);
      return entry;
    },
  };
}
