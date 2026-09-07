import type { Session } from '@supabase/supabase-js';

export type AccountScope = Readonly<{ key: string; userId: string | null }>;

export function accountScope(userId: string | null): AccountScope {
  if (userId !== null && !userId.trim()) throw new Error('La cuenta necesita un identificador.');
  return Object.freeze({ key: userId === null ? 'guest' : `user:${encodeURIComponent(userId)}`, userId });
}

export function scopedStorageKey(scope: AccountScope, key: string) {
  return `seed:v2:${scope.key}:${key}`;
}

export type SyncAccess = Readonly<{ userId: string; accessToken: string; signal: AbortSignal }>;
let nextLeaseId = 0;

/** One lifetime per identity. Token refresh does not change the owner. */
export class AccountLease {
  readonly id = ++nextLeaseId;
  readonly scope: AccountScope;
  private controller = new AbortController();
  private session: Session | null;

  constructor(session: Session | null) {
    this.session = session;
    this.scope = accountScope(session?.user.id ?? null);
  }

  get signal() { return this.controller.signal; }
  isActive = () => !this.signal.aborted;
  revoke = () => this.controller.abort();

  refresh(session: Session | null) {
    if ((session?.user.id ?? null) !== this.scope.userId) {
      throw new Error('No se puede cambiar el propietario de un jardín abierto.');
    }
    this.session = session;
  }

  syncAccess(): SyncAccess {
    this.signal.throwIfAborted();
    if (!this.session || !this.scope.userId || this.session.user.id !== this.scope.userId) throw new Error('Inicia sesión para sincronizar.');
    return { userId: this.scope.userId, accessToken: this.session.access_token, signal: this.signal };
  }
}
