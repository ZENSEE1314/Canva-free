// Tiny IndexedDB wrapper for storing designs, versions and settings locally in the browser.
const DB_NAME = 'artvas';
let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('designs')) db.createObjectStore('designs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('versions')) {
          const v = db.createObjectStore('versions', { keyPath: 'id' });
          v.createIndex('designId', 'designId');
        }
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const result = fn(store);
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        t.onerror = () => reject(t.error);
      })
  );
}

// Designs
export const saveDesign = (design) => tx('designs', 'readwrite', (s) => s.put(design));
export const getDesign = (id) => tx('designs', 'readonly', (s) => s.get(id));
export async function deleteDesign(id) {
  await tx('designs', 'readwrite', (s) => s.delete(id));
  const versions = await listVersions(id);
  await tx('versions', 'readwrite', (s) => versions.forEach((v) => s.delete(v.id)));
}
export async function listDesigns() {
  const all = await tx('designs', 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Version history
const MAX_VERSIONS = 30;
export async function listVersions(designId) {
  const all = await tx('versions', 'readonly', (s) => s.index('designId').getAll(designId));
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveVersion(design, label = '') {
  const v = { id: uid(), designId: design.id, createdAt: Date.now(), label, design: structuredClone(design) };
  await tx('versions', 'readwrite', (s) => s.put(v));
  const all = await listVersions(design.id);
  const extra = all.slice(MAX_VERSIONS);
  if (extra.length) await tx('versions', 'readwrite', (s) => extra.forEach((x) => s.delete(x.id)));
  return v;
}
export const getVersion = (id) => tx('versions', 'readonly', (s) => s.get(id));
export const deleteVersion = (id) => tx('versions', 'readwrite', (s) => s.delete(id));

// Key/value settings (brand kit, etc.)
export const kvGet = (key) => tx('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key, value) => tx('kv', 'readwrite', (s) => s.put(value, key));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
