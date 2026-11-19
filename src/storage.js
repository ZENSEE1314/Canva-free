// Tiny IndexedDB wrapper for storing designs locally in the browser.
const DB_NAME = 'artvas';
const STORE = 'designs';
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const result = fn(store);
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        t.onerror = () => reject(t.error);
      })
  );
}

export const saveDesign = (design) => tx('readwrite', (s) => s.put(design));
export const getDesign = (id) => tx('readonly', (s) => s.get(id));
export const deleteDesign = (id) => tx('readwrite', (s) => s.delete(id));
export async function listDesigns() {
  const all = await tx('readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
