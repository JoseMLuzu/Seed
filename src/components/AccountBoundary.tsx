import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AccountLease } from '../accountScope';
import { initialAuthCallbackError, initialAuthIntent, supabase } from '../supabase';
import { invalidateNativeAccountTasks } from '../native/accountPrivacy';
import { clearSeedNotifications } from '../native/notifications';
import { stopFocusLiveActivity } from '../native/liveActivity';
import { updateSeedWidget } from '../native/widget';
import { consumeAuthCallback, getAuthIntent, isAuthCallbackUrl } from '../authFlow';

export type AccountAuthFlow = {
  passwordRecovery: boolean;
  callbackError: string;
  completeAuthFlow: () => void;
};

export default function AccountBoundary({ children }: {
  children: (session: Session | null, lease: AccountLease, authFlow: AccountAuthFlow) => ReactNode;
}) {
  const [ready, setReady] = useState<{ session: Session | null; lease: AccountLease } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [passwordRecovery, setPasswordRecovery] = useState(() => initialAuthIntent === 'recovery');
  const [callbackError, setCallbackError] = useState(initialAuthCallbackError);

  useEffect(() => {
    let disposed = false;
    let current: AccountLease | null = null;
    let authEvents = 0;

    const accept = (session: Session | null) => {
      if (disposed) return;
      if (current?.isActive() && current.scope.userId === (session?.user.id ?? null)) {
        current.refresh(session);
        // Do not expose the workspace before the native reset has finished.
        setReady(value => value?.lease === current ? { session, lease: current! } : value);
        return;
      }
      current?.revoke(); // Synchronous: revoke old network work before React renders again.
      invalidateNativeAccountTasks();
      const lease = new AccountLease(session);
      current = lease;
      setReady(null);
      setError('');
      void Promise.all([
        clearSeedNotifications(true),
        stopFocusLiveActivity(true),
        updateSeedWidget({ title: 'Seeds', subtitle: 'Abre tu jardín', action: 'Abrir', metric: '0',
          seeds: 0, sprouts: 0, harvests: 0, watering: 0, streak: 0, updatedAt: Date.now() }, true),
      ]).then(() => {
        if (!disposed && current === lease && lease.isActive()) setReady({ session, lease });
      }).catch(() => {
        if (!disposed && current === lease) setError('No se pudo preparar el cambio de cuenta. Inténtalo de nuevo.');
      });
    };

    if (!supabase) accept(null);
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      authEvents += 1;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setCallbackError('');
      }
      accept(session);
    }).data.subscription;

    const handleNativeUrl = (event: Event) => {
      const url = (event as CustomEvent<{ url?: string }>).detail?.url || '';
      if (!supabase || !isAuthCallbackUrl(url)) return;
      setCallbackError('');
      if (getAuthIntent(url) === 'recovery') {
        setPasswordRecovery(true);
      }
      void consumeAuthCallback(supabase, url).catch(callbackError => {
        console.error('Seeds auth callback failed', callbackError);
        if (!disposed) {
          setPasswordRecovery(getAuthIntent(url) === 'recovery');
          setCallbackError('El enlace ya no es válido o expiró.');
        }
      });
    };
    window.addEventListener('seed:native-url', handleNativeUrl);
    const seedWindow = window as Window & { __seedPendingAuthUrl?: string };
    if (seedWindow.__seedPendingAuthUrl) {
      const pendingUrl = seedWindow.__seedPendingAuthUrl;
      delete seedWindow.__seedPendingAuthUrl;
      handleNativeUrl(new CustomEvent('seed:native-url', { detail: { url: pendingUrl } }));
    }
    const initialEvents = authEvents;
    void supabase?.auth.getSession().then(({ data, error }) => {
      if (disposed || initialEvents !== authEvents) return;
      if (error) throw error;
      accept(data.session);
    }).catch(() => {
      if (!disposed && initialEvents === authEvents) setError('No se pudo comprobar tu sesión. Tus datos siguen guardados.');
    });
    return () => {
      disposed = true;
      current?.revoke();
      subscription?.unsubscribe();
      window.removeEventListener('seed:native-url', handleNativeUrl);
    };
  }, [attempt]);

  if (ready) return children(ready.session, ready.lease, {
    passwordRecovery,
    callbackError,
    completeAuthFlow: () => {
      setPasswordRecovery(false);
      setCallbackError('');
    },
  });
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f7f1] p-6 text-center text-[#263324]">
      <section role="status" aria-live="polite" className="max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{error ? 'Tu jardín está protegido' : 'Preparando tu jardín…'}</h1>
        <p>{error || 'Comprobando la cuenta y su almacenamiento local.'}</p>
        {error && <button className="rounded-full bg-[#263324] px-6 py-3 text-white" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>}
      </section>
    </main>
  );
}
