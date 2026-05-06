import { SeedNote } from './types';

const DB_NAME = 'seed-db';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';

function openSeedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNotesFromDb(): Promise<SeedNote[]> {
  if (!('indexedDB' in window)) {
    const saved = localStorage.getItem('seed-notes');
    return saved ? JSON.parse(saved) : [];
  }

  const db = await openSeedDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readonly');
    const request = transaction.objectStore(NOTES_STORE).getAll();
    request.onsuccess = () => resolve(request.result as SeedNote[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNotesToDb(notes: SeedNote[]) {
  if (!('indexedDB' in window)) {
    localStorage.setItem('seed-notes', JSON.stringify(notes));
    return;
  }

  const db = await openSeedDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    store.clear();
    notes.forEach(note => store.put(note));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function migrateLocalNotesToDb() {
  const saved = localStorage.getItem('seed-notes');
  if (!saved || !('indexedDB' in window)) return;

  const existing = await loadNotesFromDb();
  if (existing.length > 0) return;

  await saveNotesToDb(JSON.parse(saved));
}
