import { signal, WritableSignal } from '@angular/core';

/**
 * A WritableSignal that persists to localStorage on every write.
 *
 * Patching `set`/`update` (rather than using an `effect`) means these can be
 * created at field-initialiser time in a service without needing an injection
 * context, and a write is durable immediately rather than after change
 * detection settles — which matters because a child slamming the tab shut
 * mid-game should not lose her stars.
 */
export function storedSignal<T>(key: string, initial: T): WritableSignal<T> {
  const s = signal<T>(readJson(key, initial));
  const originalSet = s.set.bind(s);
  const originalUpdate = s.update.bind(s);

  s.set = (value: T) => {
    originalSet(value);
    writeJson(key, value);
  };
  s.update = (fn: (value: T) => T) => {
    originalUpdate(fn);
    writeJson(key, s());
  };
  return s;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unreadable (private mode, quota, hand-edited) — start fresh
    // rather than crashing the whole app on boot.
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. The in-memory signal still works for this
    // session, so degrade quietly instead of interrupting play.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
