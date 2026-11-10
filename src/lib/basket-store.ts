"use client";
// The visitor's test basket: a list of test slugs kept in this browser only (localStorage).
// No account, nothing sent to the server except as the ?t= list on /basket. Every read and
// write is wrapped: private mode or blocked storage just means an empty basket.
import { useSyncExternalStore } from "react";
import { BASKET_MAX } from "./pricing";

const KEY = "tm_basket";
const EVENT = "tm-basket";
const EMPTY: string[] = [];

let cacheRaw: string | null = null;
let cacheList: string[] = EMPTY;

/** Current list straight from storage (use in effects: during hydration useBasket still returns []). */
export function readBasket(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw === cacheRaw) return cacheList; // same snapshot object while unchanged (useSyncExternalStore)
  cacheRaw = raw;
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    cacheList = Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)).slice(0, BASKET_MAX) : EMPTY;
  } catch { cacheList = EMPTY; }
  return cacheList;
}

export function setBasket(slugs: string[]) {
  const clean = [...new Set(slugs)].slice(0, BASKET_MAX);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); }; // other tabs
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}

export function useBasket(): string[] {
  return useSyncExternalStore(subscribe, readBasket, () => EMPTY);
}

export const basketHref = (slugs: string[]) => (slugs.length ? `/basket?t=${slugs.join(",")}` : "/basket");
