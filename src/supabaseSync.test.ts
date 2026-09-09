import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteOwnAccountFromSupabase, fetchGardenFromSupabase, pushGardenToSupabase, syncGardenWithSupabase, deletePlanetFromSupabase } from './supabaseSync';
import type { SyncAccess } from './accountScope';

type Request = { table: string; operation: string; filters: Record<string, string>; headers: Record<string, string>; signal?: AbortSignal; rows?: unknown[] };
function backend(onRequest: (request: Request) => Promise<unknown[]> | unknown[] = () => []) {
  const requests: Request[] = [];
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
        try { requests.push(request); return resolve({ data: await onRequest(request), error: null }); }
        catch (error) { return reject(error); }
      },
    };
    return query;
  } } as unknown as NonNullable<Parameters<typeof pushGardenToSupabase>[2]>;
  return { client, requests };
}
const access = (controller = new AbortController()): SyncAccess => ({ userId: 'A', accessToken: 'token-A', signal: controller.signal });

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
