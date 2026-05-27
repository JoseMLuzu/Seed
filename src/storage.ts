import { SeedNote } from './types';
import { normalizeNotes } from './normalize';

const DB_NAME = 'seed-db';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';

function loadLocalNotesFallback(): SeedNote[] {
  try {
    const saved = localStorage.getItem('seed-notes');
    const parsed = saved ? JSON.parse(saved) : [];
    return normalizeNotes(parsed);
  } catch {
    return [];
  }
}

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
    return loadLocalNotesFallback();
  }

  try {
    const db = await openSeedDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(NOTES_STORE, 'readonly');
      const request = transaction.objectStore(NOTES_STORE).getAll();
      request.onsuccess = () => resolve(normalizeNotes(request.result));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return loadLocalNotesFallback();
  }
}

export async function saveNotesToDb(notes: SeedNote[]) {
  try {
    localStorage.setItem('seed-notes', JSON.stringify(notes));
  } catch {
    // IndexedDB remains the primary store when localStorage is unavailable or full.
  }

  if (!('indexedDB' in window)) {
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

  await saveNotesToDb(loadLocalNotesFallback());
}
