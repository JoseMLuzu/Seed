import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import type { Session } from '@supabase/supabase-js';
import { AccountLease, accountScope, scopedStorageKey } from './accountScope';
import { createAccountStorage } from './appStorage';
import { loadLegacyNotes, loadNotesFromDb, saveNotesToDb } from './storage';
import { assertLegacyRecoveryOwner, reserveLegacyRecovery, mergeLegacyGarden } from './legacyRecovery';
import { invalidateNativeAccountTasks, runNativeAccountTask } from './native/accountPrivacy';
import type { SeedNote } from './types';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const guest = accountScope(null);
const a = accountScope('account-a');
const b = accountScope('account-b');
const note = (title: string): SeedNote => ({ id: 'same-id', title, content: title, createdAt: 100,
  tags: [], tasks: [], isGrowth: false, growthStage: 'seed' });
const session = (id: string, token = id): Session => ({ user: { id }, access_token: token } as Session);

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: new IDBFactory(), configurable: true });
});

test('guest, A and B have independent preferences and never inherit unowned values', () => {
  localStorage.setItem('seed-account', 'unowned profile');
  for (const scope of [guest, a, b]) assert.equal(createAccountStorage(scope).getStoredItem('seed-account'), null);
  createAccountStorage(a).setStoredItem('seed-account', 'A');
  createAccountStorage(b).setStoredItem('seed-account', 'B');
  createAccountStorage(guest).setStoredItem('seed-account', 'guest');
  assert.equal(createAccountStorage(a).getStoredItem('seed-account'), 'A');
  assert.equal(createAccountStorage(b).getStoredItem('seed-account'), 'B');
  assert.equal(createAccountStorage(guest).getStoredItem('seed-account'), 'guest');
  assert.notEqual(accountScope('guest').key, guest.key);
  assert.equal(createAccountStorage(a).getStoredNumber('hour', 9, 0, 23), 9);
  createAccountStorage(a).setStoredItem('hour', '0');
  assert.equal(createAccountStorage(a).getStoredNumber('hour', 9, 0, 23), 0);
});

test('leases pin ownership, refresh same-account tokens and revoke earlier access', () => {
  const first = new AccountLease(session('account-a', 'token-1'));
  const old = first.syncAccess();
  first.refresh(session('account-a', 'token-2'));
  assert.equal(old.accessToken, 'token-1');
  assert.equal(first.syncAccess().accessToken, 'token-2');
  assert.throws(() => first.refresh(session('account-b')));
  first.revoke();
  assert.equal(old.signal.aborted, true);
  assert.throws(() => first.syncAccess());
  assert.throws(() => new AccountLease(null).syncAccess());
  assert.notEqual(new AccountLease(session('account-a')).id, first.id);
});

test('IndexedDB and fallback keep identical note ids independent between three owners', async () => {
  await Promise.all([saveNotesToDb(a, [note('A')]), saveNotesToDb(b, [note('B')]), saveNotesToDb(guest, [note('guest')])]);
  for (const [scope, title] of [[a, 'A'], [b, 'B'], [guest, 'guest']] as const) {
    assert.equal((await loadNotesFromDb(scope))[0].title, title);
    localStorage.removeItem(scopedStorageKey(scope, 'notes'));
    assert.equal((await loadNotesFromDb(scope))[0].title, title);
  }
});

test('late writes remain in their captured account, including immediate switch-back', async () => {
  const pending = saveNotesToDb(a, [note('draft A')]);
  await saveNotesToDb(b, [note('B')]);
  await pending;
  assert.equal((await loadNotesFromDb(a))[0].title, 'draft A');
  assert.equal((await loadNotesFromDb(b))[0].title, 'B');
});

test('queued snapshots preserve latest revision, including a deliberately empty garden', async () => {
  await Promise.all([saveNotesToDb(a, [note('old')]), saveNotesToDb(a, [note('new')]), saveNotesToDb(a, [])]);
  assert.deepEqual(await loadNotesFromDb(a), []);
});

test('localStorage fallback works without IndexedDB and cannot leak to B', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  await saveNotesToDb(a, [note('A offline')]);
  assert.equal((await loadNotesFromDb(a))[0].title, 'A offline');
  assert.deepEqual(await loadNotesFromDb(b), []);
});

test('a newer fallback wins over a stale database after a database outage', async () => {
  await saveNotesToDb(a, [note('old database')]);
  const database = indexedDB;
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  await saveNotesToDb(a, [note('latest fallback')]);
  Object.defineProperty(globalThis, 'indexedDB', { value: database, configurable: true });
  assert.equal((await loadNotesFromDb(a))[0].title, 'latest fallback');
});

test('storage exhaustion is reported if neither persistence mechanism succeeds', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(saveNotesToDb(a, [note('not persisted')]));
});

test('corrupt scoped data is not silently replaced by an empty garden', async () => {
  localStorage.setItem(scopedStorageKey(a, 'notes'), '{broken');
  await assert.rejects(loadNotesFromDb(a));
  assert.equal(localStorage.getItem(scopedStorageKey(a, 'notes')), '{broken');
});

test('legacy data stays unassigned until explicit recovery and originals survive', async () => {
  localStorage.setItem('seed-notes', JSON.stringify([note('legacy')]));
  assert.deepEqual(await loadNotesFromDb(a), []);
  assert.deepEqual(await loadNotesFromDb(guest), []);
  const legacy = await loadLegacyNotes();
  assert.equal(legacy[0].title, 'legacy');
  reserveLegacyRecovery(a);
  await saveNotesToDb(a, legacy);
  assert.throws(() => assertLegacyRecoveryOwner(b));
  assert.throws(() => assertLegacyRecoveryOwner(guest));
  assertLegacyRecoveryOwner(a);
  assert.ok(localStorage.getItem('seed-notes')?.includes('legacy'));
});

test('recovery retries never replace existing destination notes', () => {
  const current = { notes: [note('current')], planets: [] };
  assert.deepEqual(mergeLegacyGarden(current, { notes: [note('legacy')], planets: [] }), current);
});

test('legacy IndexedDB-only notes remain recoverable without migrating them at login', async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('seed-db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('notes', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('notes', 'readwrite');
      tx.objectStore('notes').put(note('legacy database only'));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
  assert.deepEqual(await loadNotesFromDb(a), []);
  assert.equal((await loadLegacyNotes())[0].title, 'legacy database only');
  assert.equal((await loadLegacyNotes())[0].title, 'legacy database only');
});

test('IndexedDB persists notes even when localStorage is unavailable', async () => {
  localStorage.setItem = () => { throw new Error('quota'); };
  await saveNotesToDb(a, [note('database only')]);
  assert.equal((await loadNotesFromDb(a))[0].title, 'database only');
});

test('native privacy reset waits for in-flight work and discards queued old work', async () => {
  const events: string[] = [];
  let finish!: () => void;
  const inFlight = runNativeAccountTask(async () => {
    events.push('old-start');
    await new Promise<void>(resolve => { finish = resolve; });
    events.push('old-finish');
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const stale = runNativeAccountTask(async () => { events.push('stale'); });
  invalidateNativeAccountTasks();
  const reset = runNativeAccountTask(async () => { events.push('reset'); });
  finish();
  await Promise.all([inFlight, stale, reset]);
  assert.deepEqual(events, ['old-start', 'old-finish', 'reset']);
});
