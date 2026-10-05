"use client";

import { useSyncExternalStore } from "react";

const fallback = new Map<string, string>();
const eventName = "railway-preference-change";

export function readPreference(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key) ?? fallback.get(key) ?? null; }
  catch { return fallback.get(key) ?? null; }
}

export function writePreference(key: string, value: string) {
  fallback.set(key, value);
  try { window.localStorage.setItem(key, value); } catch { /* Keep this visit usable without storage. */ }
  window.dispatchEvent(new Event(eventName));
}

function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function usePreference(key: string) {
  return useSyncExternalStore(subscribe, () => readPreference(key), () => null);
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
