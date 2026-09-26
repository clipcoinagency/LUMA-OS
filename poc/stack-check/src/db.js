// Minimal IndexedDB access used by the stack check (the real layer comes from poc/web in Phase 1).
const DB_NAME = 'lifeos-stack-check';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('meta', { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function bumpLaunches() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('meta', 'readwrite', { durability: 'strict' });
    const os = t.objectStore('meta');
    let count = 0;
    os.get('launches').onsuccess = (e) => {
      count = (e.target.result?.value ?? 0) + 1;
      os.put({ key: 'launches', value: count });
    };
    t.oncomplete = () => resolve(count);
    t.onerror = () => reject(t.error);
  });
}
