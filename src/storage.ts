import type { SeedNote } from './types';
import { normalizeNotes } from './normalize';
import { scopedStorageKey, type AccountScope } from './accountScope';

const NOTES_STORE = 'notes';
const META_STORE = 'metadata';
type StoredNotes = { revision: number; notes: SeedNote[] };
const writeQueues = new Map<string, Promise<void>>();
let lastRevision = 0;

function hasIndexedDb() { return typeof indexedDB !== 'undefined'; }

function openSeedDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(NOTES_STORE, { keyPath: 'id' });
      request.result.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra las otras ventanas de Seeds para abrir el almacenamiento.'));
  });
}

function readFallback(scope: AccountScope): StoredNotes | null {
  const raw = localStorage.getItem(scopedStorageKey(scope, 'notes'));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.notes) || typeof parsed.revision !== 'number') {
    throw new Error('La copia local no se pudo leer. No se sobrescribieron tus datos.');
  }
  return { revision: parsed.revision, notes: normalizeNotes(parsed.notes) };
}

async function readDatabase(name: string): Promise<StoredNotes> {
  const db = await openSeedDb(name);
  try {
    return await new Promise((resolve, reject) => {
      const hasMetadata = db.objectStoreNames.contains(META_STORE);
      const tx = db.transaction(hasMetadata ? [NOTES_STORE, META_STORE] : [NOTES_STORE], 'readonly');
      const notes = tx.objectStore(NOTES_STORE).getAll();
      const revision = hasMetadata ? tx.objectStore(META_STORE).get('revision') : null;
      tx.oncomplete = () => resolve({ notes: normalizeNotes(notes.result), revision: revision?.result || 0 });
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudieron leer las notas.'));
    });
  } finally { db.close(); }
}

export async function loadNotesFromDb(scope: AccountScope): Promise<SeedNote[]> {
  await writeQueues.get(scope.key);
  let fallback: StoredNotes | null = null;
  let fallbackError: unknown;
  try { fallback = readFallback(scope); } catch (error) { fallbackError = error; }
  lastRevision = Math.max(lastRevision, fallback?.revision || 0);
  if (hasIndexedDb()) {
    try {
      const stored = await readDatabase(scopedStorageKey(scope, 'db'));
      lastRevision = Math.max(lastRevision, stored.revision);
      if (fallback && fallback.revision > stored.revision) return fallback.notes;
      if (stored.revision || stored.notes.length || !fallbackError) return stored.notes;
    } catch (error) {
      if (!fallback) throw error;
    }
  }
  if (fallback) return fallback.notes;
  if (fallbackError) throw fallbackError;
  return [];
}

/** Snapshot writes remain full-collection for now, but never cross account scopes. */
export function saveNotesToDb(scope: AccountScope, notes: SeedNote[]): Promise<void> {
  const snapshot: StoredNotes = { revision: lastRevision = Math.max(Date.now(), lastRevision + 1), notes };
  // Synchronous fallback protects a just-edited note during pagehide/unmount.
  let fallbackSaved = false;
  try {
    localStorage.setItem(scopedStorageKey(scope, 'notes'), JSON.stringify(snapshot));
    fallbackSaved = true;
  } catch { /* The database can still persist the snapshot. */ }
  const previous = writeQueues.get(scope.key) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    if (!hasIndexedDb()) {
      if (!fallbackSaved) throw new Error('No se pudo guardar el jardín en este dispositivo.');
      return;
    }
    try {
      const db = await openSeedDb(scopedStorageKey(scope, 'db'));
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction([NOTES_STORE, META_STORE], 'readwrite');
          const store = tx.objectStore(NOTES_STORE);
          store.clear();
          snapshot.notes.forEach(note => store.put(note));
          tx.objectStore(META_STORE).put(snapshot.revision, 'revision');
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el jardín.'));
        });
      } finally { db.close(); }
    } catch (error) { if (!fallbackSaved) throw error; }
  });
  writeQueues.set(scope.key, write);
  void write.finally(() => { if (writeQueues.get(scope.key) === write) writeQueues.delete(scope.key); }).catch(() => {});
  return write;
}

/** Legacy unowned data is read only on an explicit recovery action, never at sign-in. */
export async function loadLegacyNotes(): Promise<SeedNote[]> {
  const raw = localStorage.getItem('seed-notes');
  const fallback = raw ? normalizeNotes(JSON.parse(raw)) : [];
  if (!hasIndexedDb()) return fallback;
  try {
    const stored = await readDatabase('seed-db');
    const byId = new Map(fallback.map(note => [note.id, note]));
    for (const note of stored.notes) {
      const previous = byId.get(note.id);
      if (!previous || (note.updatedAt || note.createdAt) >= (previous.updatedAt || previous.createdAt)) byId.set(note.id, note);
    }
    return [...byId.values()];
  } catch (error) {
    if (!raw) throw error;
    return fallback;
  }
}
