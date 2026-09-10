import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { accountScope, type SyncAccess } from './accountScope';
import { flushSyncQueue } from './supabaseSync';
	import {
	applySyncTombstones,
  completeSyncMutation,
  deferSyncMutation,
  diffSyncSnapshots,
  enqueueSyncMutations,
  loadSyncQueue,
  mergeSyncSnapshots,
} from './syncQueue';
import type { Planet, SeedNote } from './types';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const a = accountScope('A');
const b = accountScope('B');
const access = (controller = new AbortController()): SyncAccess => ({ userId: 'A', accessToken: 'token-A', signal: controller.signal });
const note = (title: string, updatedAt = 100): SeedNote => ({
  id: 'note-1', title, content: title, createdAt: 10, updatedAt, tags: [], tasks: [], isGrowth: false, growthStage: 'seed', planetId: 'planet-1',
});
const planet = (name: string, updatedAt = 100): Planet => ({
  id: 'planet-1', name, description: '', theme: 'earth', createdAt: 10, updatedAt,
});

type Request = { table: string; operation: string; filters: Record<string, string>; rows?: unknown[]; params?: Record<string, unknown> };
function backend(failAt = -1, conflict = false) {
  const requests: Request[] = [];
	const finish = (request: Request) => {
	  requests.push(request);
	  return Promise.resolve({
	    data: request.table === 'rpc' ? { status: 'applied', revision: requests.length, conflict } : null,
	    error: requests.length === failAt ? new Error('offline') : null,
	  });
	};
  const client = { from(table: string) {
    const request: Request = { table, operation: '', filters: {} };
    const query = {
      upsert(rows: unknown[]) { request.operation = 'upsert'; request.rows = rows; return query; },
      delete() { request.operation = 'delete'; return query; },
      eq(key: string, value: string) { request.filters[key] = value; return query; },
      setHeader() { return query; },
	      abortSignal() { return finish(request); },
    };
    return query;
	  }, rpc(name: string, params: Record<string, unknown>) {
	    const request: Request = { table: 'rpc', operation: name, filters: {}, params };
	    const query = {
	      setHeader() { return query; },
	      abortSignal() { return finish(request); },
	    };
	    return query;
	  } };
  return { client: client as never, requests };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
});

test('queue is account scoped and compacts repeated edits to the latest entity state', () => {
  enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('first') }], 100);
  enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('latest', 200) }], 200);
  enqueueSyncMutations(b, [{ entity: 'planet', action: 'upsert', entityId: 'planet-1', value: planet('B') }], 300);

  assert.equal(loadSyncQueue(a).length, 1);
  assert.equal(loadSyncQueue(a)[0].action, 'upsert');
  assert.equal((loadSyncQueue(a)[0] as { value: SeedNote }).value.title, 'latest');
  assert.equal(loadSyncQueue(b).length, 1);
});

test('acknowledging an in-flight edit never removes a newer edit of the same note', () => {
  const first = enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('first') }], 100)[0];
  enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('newer', 200) }], 200);
	completeSyncMutation(a, first, 201);
  assert.equal(loadSyncQueue(a).length, 1);
  assert.equal((loadSyncQueue(a)[0] as { value: SeedNote }).value.title, 'newer');
	assert.equal(loadSyncQueue(a)[0].baseVersion, 201);
	completeSyncMutation(a, loadSyncQueue(a)[0], 202);
	const afterRealtimeDelay = enqueueSyncMutations(a, [{
	  entity: 'note', action: 'upsert', entityId: 'note-1', value: note('after ack'), baseVersion: 0,
	}], 300);
	assert.equal(afterRealtimeDelay[0].baseVersion, 202);
});

test('snapshot diff orders parent upserts before notes and note deletes before planet deletes', () => {
  const drafts = diffSyncSnapshots(
    { planets: [planet('old')], notes: [note('old')] },
    { planets: [{ ...planet('new'), id: 'planet-2' }], notes: [{ ...note('new'), id: 'note-2', planetId: 'planet-2' }] },
  );
  assert.deepEqual(drafts.map(item => `${item.action}:${item.entity}`), [
    'upsert:planet', 'upsert:note', 'delete:note', 'delete:planet',
  ]);
});

test('merge chooses the newest copy and never treats an absent remote entity as deleted', () => {
  const merged = mergeSyncSnapshots(
    { planets: [planet('local', 300)], notes: [note('local', 100)] },
    { planets: [planet('remote', 200)], notes: [note('remote', 200), { ...note('remote-only'), id: 'note-2' }] },
  );
  assert.equal(merged.planets[0].name, 'local');
  assert.equal(merged.notes.find(item => item.id === 'note-1')?.title, 'remote');
  assert.equal(merged.notes.find(item => item.id === 'note-2')?.title, 'remote-only');
});

test('server revisions beat device clocks and tombstones remove stale local entities', () => {
	const merged = mergeSyncSnapshots(
	  { planets: [{ ...planet('local clock', 9_999), syncVersion: 4 }], notes: [{ ...note('local clock', 9_999), syncVersion: 4 }] },
	  { planets: [{ ...planet('server', 100), syncVersion: 5 }], notes: [{ ...note('server', 100), syncVersion: 5 }] },
	);
	assert.equal(merged.planets[0].name, 'server');
	assert.equal(merged.notes[0].title, 'server');
	assert.deepEqual(applySyncTombstones(merged, [
	  { entity: 'note', entityId: 'note-1', syncVersion: 6 },
	  { entity: 'planet', entityId: 'planet-1', syncVersion: 7 },
	]), { planets: [], notes: [] });
});

test('failed mutations remain durable with exponential retry metadata', async () => {
  enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('offline') }], 100);
  const { client, requests } = backend(1);
  const result = await flushSyncQueue(a, access(), client, { force: true });
  const pending = loadSyncQueue(a);
  assert.equal(requests.length, 1);
  assert.equal(result.pending, 1);
  assert.equal(pending[0].attempts, 1);
  assert.ok(pending[0].nextAttemptAt > Date.now());

  const retryAt = deferSyncMutation(a, pending[0].mutationId, 1_000, () => 0);
  assert.equal(retryAt, 3_000);
});

test('flush sends one versioned RPC per mutation and removes only confirmed operations', async () => {
  enqueueSyncMutations(a, [
    { entity: 'planet', action: 'upsert', entityId: 'planet-1', value: planet('Garden') },
    { entity: 'note', action: 'upsert', entityId: 'note-1', value: note('One note') },
  ], 100);
  const { client, requests } = backend();
  const result = await flushSyncQueue(a, access(), client, { force: true });
  assert.equal(result.processed, 2);
  assert.equal(result.pending, 0);
	  assert.deepEqual(requests.map(request => [request.operation, request.params?.p_entity_type, request.params?.p_action]), [
	    ['apply_seed_mutation', 'planet', 'upsert'],
	    ['apply_seed_mutation', 'note', 'upsert'],
  ]);
  assert.deepEqual(loadSyncQueue(a), []);
});

test('queued deletes remain durable until the versioned server operation succeeds', async () => {
  enqueueSyncMutations(a, [{ entity: 'planet', action: 'delete', entityId: 'planet-1' }], 100);
	  const { client, requests } = backend(1);
  const failed = await flushSyncQueue(a, access(), client, { force: true });
  assert.equal(failed.pending, 1);
	  assert.equal(requests[0].operation, 'apply_seed_mutation');
	  assert.equal(requests[0].params?.p_action, 'delete');
	  assert.equal(requests[0].params?.p_entity_id, 'planet-1');

  const retry = backend();
  const completed = await flushSyncQueue(a, access(), retry.client, { force: true });
  assert.equal(completed.pending, 0);
  assert.deepEqual(loadSyncQueue(a), []);
});

test('a revoked lease cannot consume another account queue', async () => {
  enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('private') }], 100);
  const controller = new AbortController();
  controller.abort();
  const { client, requests } = backend();
  await assert.rejects(flushSyncQueue(a, access(controller), client, { force: true }));
  assert.equal(requests.length, 0);
  assert.equal(loadSyncQueue(a).length, 1);
});

test('server conflict acknowledgements are counted and still clear the durable mutation', async () => {
	enqueueSyncMutations(a, [{ entity: 'note', action: 'upsert', entityId: 'note-1', value: note('conflict'), baseVersion: 3 }], 100);
	const { client } = backend(-1, true);
	const result = await flushSyncQueue(a, access(), client, { force: true });
	assert.equal(result.conflicts, 1);
	assert.equal(result.pending, 0);
});
