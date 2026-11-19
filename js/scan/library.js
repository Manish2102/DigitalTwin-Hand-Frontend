// library.js - scans saved in this browser (IndexedDB). Nothing is sent anywhere.
// A scan stores the photo, the raw depth and the mask, so it can be re-tuned or exported later
// without running the models again.

const DB = "dtl-scans", STORE = "scans";

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const run = (mode, fn) => open().then(db => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
  tx.oncomplete = () => { db.close(); resolve(req?.result); };
  tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
}));

export const saveScan = scan => run("readwrite", s => s.put(scan));
export const getScan = id => run("readonly", s => s.get(id));
export const deleteScan = id => run("readwrite", s => s.delete(id));
export async function listScans() {
  const all = (await run("readonly", s => s.getAll())) || [];
  return all.sort((a, b) => b.created - a.created);
}
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
