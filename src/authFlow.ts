export type AuthIntent = 'confirmation' | 'recovery';

type AuthCallbackClient = {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{ error: Error | null }>;
    setSession: (session: { access_token: string; refresh_token: string }) => Promise<{ error: Error | null }>;
  };
};

type RuntimeLocation = Pick<Location, 'origin' | 'protocol'>;

function authParams(rawUrl: string) {
  try {
    const fallback = typeof window === 'undefined' ? 'https://seed.local' : window.location.origin;
    const url = new URL(rawUrl, fallback);
    const params = new URLSearchParams(url.search);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    fragment.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
    return { url, params };
  } catch {
    return null;
  }
}

export function getAuthIntent(rawUrl: string): AuthIntent | null {
  const parsed = authParams(rawUrl);
  if (!parsed) return null;
  const type = parsed.params.get('type')?.toLowerCase();
  const marker = parsed.params.get('auth')?.toLowerCase();
  const nativePath = `${parsed.url.host}${parsed.url.pathname}`.toLowerCase();
  if (type === 'recovery' || marker === 'recovery' || nativePath === 'auth/recovery') return 'recovery';
  if (type === 'signup' || type === 'email_change' || marker === 'confirmation' || nativePath === 'auth/confirmation') return 'confirmation';
  return null;
}

export function isAuthCallbackUrl(rawUrl: string) {
  const parsed = authParams(rawUrl);
  if (!parsed || !getAuthIntent(rawUrl)) return false;
  return Boolean(
    parsed.params.get('code')
    || (parsed.params.get('access_token') && parsed.params.get('refresh_token'))
    || parsed.params.get('error')
    || parsed.params.get('error_description'),
  );
}

export function getAuthCallbackError(rawUrl: string) {
  const parsed = authParams(rawUrl);
  if (!parsed) return '';
  const description = parsed.params.get('error_description') || parsed.params.get('error');
  return description || '';
}

export function isNativeRuntime(location: RuntimeLocation = window.location) {
  const capacitor = typeof window === 'undefined' ? undefined : (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return location.protocol === 'capacitor:' || capacitor?.isNativePlatform?.() === true;
}

export function getAuthRedirectUrl(intent: AuthIntent, location: RuntimeLocation = window.location, native = isNativeRuntime(location)) {
  if (native) return `seed://auth/${intent}`;
  const redirect = new URL('/', location.origin);
  redirect.searchParams.set('auth', intent);
  return redirect.toString();
}

export async function consumeAuthCallback(client: AuthCallbackClient, rawUrl: string) {
  const parsed = authParams(rawUrl);
  if (!parsed || !isAuthCallbackUrl(rawUrl)) return null;
  const callbackError = getAuthCallbackError(rawUrl);
  if (callbackError) throw new Error(callbackError);

  const code = parsed.params.get('code');
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : await client.auth.setSession({
        access_token: parsed.params.get('access_token')!,
        refresh_token: parsed.params.get('refresh_token')!,
      });
  if (result.error) throw result.error;
  return getAuthIntent(rawUrl);
}
