// library.js - keeps the presentations you open in this browser (IndexedDB), so they are still there after a refresh.
// Files never leave the computer. Each entry: { id, name, size, type, added, blob }.

const DB = "dtl-deck", STORE = "files";
let dbP = null;

function db() {
  dbP ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbP = null; rej(r.error); };
  });
  return dbP;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
    const req = fn(s);
    t.oncomplete = () => res(req?.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
};

export const supported = () => typeof indexedDB !== "undefined";

// Ask the browser not to evict the saved files when storage is tight (harmless if refused).
export function keepStorage() { try { navigator.storage?.persist?.(); } catch {} }

export async function list() {
  const all = await tx("readonly", s => s.getAll());
  return (all ?? []).map(({ id, name, size, type, added }) => ({ id, name, size, type, added })).sort((a, b) => b.added - a.added);
}
export async function get(id) { return tx("readonly", s => s.get(id)); }
export async function remove(id) { return tx("readwrite", s => s.delete(id)); }

// Saves a file; the same name and size replaces the old copy (re-uploading a presentation does not make duplicates).
export async function save(file) {
  const all = await list();
  const same = all.find(f => f.name === file.name && f.size === file.size);
  const id = same?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await tx("readwrite", s => s.put({ id, name: file.name, size: file.size, type: file.type, added: Date.now(), blob: file }));
  return id;
}

export async function asFile(id) {
  const e = await get(id);
  return e ? new File([e.blob], e.name, { type: e.type || e.blob.type }) : null;
}
