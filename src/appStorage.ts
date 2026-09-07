import { scopedStorageKey, type AccountScope } from './accountScope';

export function getStoredItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredItem(key: string) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getStoredNumber(key: string, fallback: number, min = -Infinity, max = Infinity) {
  const stored = getStoredItem(key);
  if (stored === null || !stored.trim()) return fallback;
  const value = Number(stored);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function getStoredBoolean(key: string, fallback: boolean) {
  const value = getStoredItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function getStoredJson<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  const value = getStoredItem(key);
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return validate && !validate(parsed) ? fallback : parsed as T;
  } catch {
    return fallback;
  }
}

export function setStoredJson(key: string, value: unknown) {
  return setStoredItem(key, JSON.stringify(value));
}

/** Bound to an immutable owner, never to a mutable global current-user variable. */
export function createAccountStorage(scope: AccountScope) {
  const keyFor = (key: string) => scopedStorageKey(scope, key);
  return {
    getStoredItem: (key: string) => getStoredItem(keyFor(key)),
    setStoredItem: (key: string, value: string) => setStoredItem(keyFor(key), value),
    removeStoredItem: (key: string) => removeStoredItem(keyFor(key)),
    getStoredBoolean: (key: string, fallback: boolean) => getStoredBoolean(keyFor(key), fallback),
    getStoredNumber: (key: string, fallback: number, min = -Infinity, max = Infinity) =>
      getStoredNumber(keyFor(key), fallback, min, max),
  };
}
