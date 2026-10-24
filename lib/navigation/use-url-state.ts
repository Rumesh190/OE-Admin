"use client";
import { useSyncExternalStore } from 'react';
const EVENT = 'ops:url-state';
function subscribe(listener: () => void) { if (typeof window === 'undefined' || !window.addEventListener) return () => {}; window.addEventListener('popstate', listener); window.addEventListener(EVENT, listener); return () => { window.removeEventListener('popstate', listener); window.removeEventListener(EVENT, listener); }; }
function snapshot() { return typeof window === 'undefined' || !window.location ? '' : window.location.pathname + window.location.search + window.location.hash; }
export function useUrlState() {
  const path = useSyncExternalStore(subscribe, snapshot, () => '');
  const params = new URLSearchParams(path.includes('?') ? path.split('?')[1].split('#')[0] : '');
  function update(values: Record<string, string | undefined>, navigation: "replace" | "push" = "replace") {
    if (!window.location || !window.history) return;
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => { if (value === undefined || value === '') url.searchParams.delete(key); else url.searchParams.set(key, value); });
    window.history[navigation === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(EVENT));
  }
  return { path, params, update };
}
