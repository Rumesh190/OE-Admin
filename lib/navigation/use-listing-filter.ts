"use client";
import { useUrlState } from "./use-url-state";

/** Keep read-only listing controls stable across scope tabs, detail return and reload. */
export function useListingFilter<T extends string>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const url = useUrlState();
  const value = (url.params.get(key) ?? initial) as T;
  return [value, next => url.update({ [key]: typeof next === "function" ? next(value) : next })];
}
