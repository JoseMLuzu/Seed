import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeAuthCallback, getAuthCallbackError, getAuthIntent, getAuthRedirectUrl, isAuthCallbackUrl } from './authFlow';

test('recognizes web and native authentication callbacks without treating normal seed links as auth', () => {
  assert.equal(getAuthIntent('https://seeds.example/?auth=recovery&code=abc'), 'recovery');
  assert.equal(getAuthIntent('seed://auth/recovery#access_token=a&refresh_token=b&type=recovery'), 'recovery');
  assert.equal(getAuthIntent('seed://auth/confirmation?code=abc'), 'confirmation');
  assert.equal(getAuthIntent('seed://today'), null);
  assert.equal(isAuthCallbackUrl('seed://auth/recovery'), false);
  assert.equal(isAuthCallbackUrl('seed://auth/recovery?code=abc'), true);
});

test('builds explicit web and native redirect URLs', () => {
  const location = { origin: 'https://seeds.example', protocol: 'https:' } as Location;
  assert.equal(getAuthRedirectUrl('recovery', location, false), 'https://seeds.example/?auth=recovery');
  assert.equal(getAuthRedirectUrl('confirmation', location, true), 'seed://auth/confirmation');
});

test('consumes PKCE codes and implicit sessions', async () => {
  const calls: string[] = [];
  const client = {
    auth: {
      exchangeCodeForSession: async (code: string) => { calls.push(`code:${code}`); return { error: null }; },
      setSession: async ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        calls.push(`tokens:${access_token}:${refresh_token}`);
        return { error: null };
      },
    },
  };
  assert.equal(await consumeAuthCallback(client, 'seed://auth/recovery?code=pkce-code'), 'recovery');
  assert.equal(await consumeAuthCallback(client, 'seed://auth/confirmation#access_token=access&refresh_token=refresh&type=signup'), 'confirmation');
  assert.deepEqual(calls, ['code:pkce-code', 'tokens:access:refresh']);
});

test('surfaces callback errors without exposing tokens', async () => {
  const url = 'seed://auth/recovery?error=access_denied&error_description=Link+expired';
  assert.equal(getAuthCallbackError(url), 'Link expired');
  await assert.rejects(() => consumeAuthCallback({ auth: {
    exchangeCodeForSession: async () => ({ error: null }),
    setSession: async () => ({ error: null }),
  } }, url), /Link expired/);
});
