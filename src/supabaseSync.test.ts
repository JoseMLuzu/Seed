import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteOwnAccountFromSupabase, fetchGardenFromSupabase, pushGardenToSupabase, syncGardenWithSupabase, deletePlanetFromSupabase, syncGardenIncrementally } from './supabaseSync';
import { accountScope, type SyncAccess } from './accountScope';
import type { SeedNote } from './types';

type Request = { table: string; operation: string; filters: Record<string, string>; headers: Record<string, string>; signal?: AbortSignal; rows?: unknown[]; params?: Record<string, unknown> };
function backend(onRequest: (request: Request) => Promise<unknown> | unknown = () => []) {
  const requests: Request[] = [];
	const resolveRequest = async (request: Request, resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) => {
	  try { requests.push(request); return resolve({ data: await onRequest(request), error: null }); }
	  catch (error) { return reject(error); }
	};
  const client = { from(table: string) {
    const request: Request = { table, operation: '', filters: {}, headers: {} };
    const query = {
      select() { request.operation = 'select'; return query; },
      upsert(rows: unknown[]) { request.operation = 'upsert'; request.rows = rows; return query; },
      delete() { request.operation = 'delete'; return query; },
      eq(key: string, value: string) { request.filters[key] = value; return query; },
      order() { return query; },
      setHeader(key: string, value: string) { request.headers[key] = value; return query; },
      abortSignal(signal: AbortSignal) { request.signal = signal; return query; },
      async then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
	        return resolveRequest(request, resolve, reject);
      },
    };
    return query;
	}, rpc(name: string, params: Record<string, unknown>) {
	  const request: Request = { table: 'rpc', operation: name, filters: {}, headers: {}, params };
	  const query = {
	    setHeader(key: string, value: string) { request.headers[key] = value; return query; },
	    abortSignal(signal: AbortSignal) { request.signal = signal; return query; },
	    async then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
	      return resolveRequest(request, resolve, reject);
	    },
	  };
	  return query;
	} } as never;
  return { client, requests };
}
const access = (controller = new AbortController()): SyncAccess => ({ userId: 'A', accessToken: 'token-A', signal: controller.signal });

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

test('mismatched snapshot ownership is rejected before any network operation', async () => {
  const { client, requests } = backend();
  await assert.rejects(pushGardenToSupabase({ ownerId: 'B', notes: [], planets: [] }, access(), client));
  await assert.rejects(syncGardenWithSupabase({ ownerId: 'B', notes: [], planets: [] }, access(), client));
  assert.equal(requests.length, 0);
});

test('reads pin bearer token, owner filter and cancellation; reject foreign rows defensively', async () => {
  const { client, requests } = backend(() => [{ id: 'foreign', user_id: 'B', data: { id: 'foreign' } }]);
  assert.deepEqual(await fetchGardenFromSupabase(access(), client), { notes: [], planets: [] });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.filters.user_id, 'A');
    assert.equal(request.headers.Authorization, 'Bearer token-A');
    assert.ok(request.signal);
  }
});

test('revoking the account during a read prevents the next read and all uploads', async () => {
  const controller = new AbortController();
  const { client, requests } = backend(() => { controller.abort(); return []; });
  await assert.rejects(syncGardenWithSupabase({ ownerId: 'A', notes: [], planets: [] }, access(controller), client));
  assert.equal(requests.length, 1);
});

test('revoking during planet deletion prevents the second destructive request', async () => {
  const controller = new AbortController();
  const { client, requests } = backend(() => { controller.abort(); return []; });
  await assert.rejects(deletePlanetFromSupabase('personal', access(controller), client));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].filters.user_id, 'A');
});

test('an already revoked account performs no requests', async () => {
  const controller = new AbortController();
  controller.abort();
  const { client, requests } = backend();
  await assert.rejects(fetchGardenFromSupabase(access(controller), client));
  assert.equal(requests.length, 0);
});

test('account deletion calls only the authenticated self-delete RPC with pinned access', async () => {
  const request = { rpc: '', headers: {} as Record<string, string>, signal: undefined as AbortSignal | undefined };
  const client = { rpc(name: string) {
    request.rpc = name;
    const query = {
      setHeader(key: string, value: string) { request.headers[key] = value; return query; },
      abortSignal(signal: AbortSignal) { request.signal = signal; return Promise.resolve({ data: true, error: null }); },
    };
    return query;
  } } as unknown as NonNullable<Parameters<typeof deleteOwnAccountFromSupabase>[1]>;

  await deleteOwnAccountFromSupabase(access(), client);
  assert.equal(request.rpc, 'delete_own_account');
  assert.equal(request.headers.Authorization, 'Bearer token-A');
  assert.ok(request.signal);
});

test('account deletion is rejected before the RPC when its lease was revoked', async () => {
  let called = false;
  const client = { rpc() { called = true; throw new Error('must not run'); } } as unknown as NonNullable<Parameters<typeof deleteOwnAccountFromSupabase>[1]>;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(deleteOwnAccountFromSupabase(access(controller), client));
  assert.equal(called, false);
});

test('incremental reconciliation persists and sends only the local entity missing remotely', async () => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  const localNote: SeedNote = {
    id: 'local-note', title: 'Local', content: '', createdAt: 100, updatedAt: 200,
    tags: [], tasks: [], isGrowth: false, growthStage: 'seed', planetId: 'personal',
  };
  const remoteNotes: unknown[] = [];
  const { client, requests } = backend(request => {
    if (request.operation === 'select') return request.table === 'seed_notes' ? remoteNotes : [];
	    if (request.operation === 'apply_seed_mutation' && request.params?.p_entity_type === 'note') {
	      const payload = request.params.p_payload as SeedNote;
	      remoteNotes.splice(0, remoteNotes.length, {
	        id: request.params.p_entity_id,
	        user_id: 'A',
	        planet_id: payload.planetId || 'personal',
	        data: payload,
	        server_revision: 1,
	      });
	      return { status: 'applied', revision: 1, conflict: false };
    }
    return request.rows || [];
  });

  const synced = await syncGardenIncrementally(
    accountScope('A'),
    { ownerId: 'A', planets: [], notes: [localNote] },
    access(),
    client,
  );
  const noteUpserts = requests.filter(request => request.operation === 'apply_seed_mutation' && request.params?.p_entity_type === 'note');
  assert.equal(noteUpserts.length, 1);
	  assert.equal((noteUpserts[0].params?.p_payload as SeedNote).id, 'local-note');
	  assert.equal(noteUpserts[0].params?.p_base_revision, 0);
  assert.equal(synced.notes[0].id, 'local-note');
});
