// Typed dataLayer pushes (GTM reads them; GA4 is configured inside GTM by the owner).
// Rule from the brief: never put personal data (name, phone) in an event — the types below
// have no field for it, and `track` drops anything that is not a known parameter.

type Ctx = { test_slug?: string; lab_slug?: string; area_slug?: string };

export type AnalyticsEvents = {
  search: { search_term: string; results_count: number };
  view_test_prices: { test_slug: string; area_slug?: string; lab_count: number; min_price: number };
  booking_form_open: Ctx & { price: number };
  generate_lead: Ctx & { price: number; booking_id: number };
  whatsapp_click: Ctx;
  call_click: Ctx;
};

const ALLOWED = new Set(["search_term", "results_count", "test_slug", "area_slug", "lab_slug", "lab_count", "min_price", "price", "booking_id"]);

declare global {
  interface Window { dataLayer?: Record<string, unknown>[] }
}

/** Builds the object pushed to dataLayer: snake_case params, no empty values, only allowed keys. */
export function eventPayload<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]): Record<string, unknown> {
  const out: Record<string, unknown> = { event };
  for (const [k, v] of Object.entries(params)) if (ALLOWED.has(k) && v !== undefined && v !== null && v !== "") out[k] = v;
  return out;
}

export function track<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(eventPayload(event, params));
}

// ── UTM / referrer (first touch in this browser session) ──

export const ATTRIBUTION_KEY = "td_attr";
export type Attribution = {
  utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string;
  referrer?: string; landingPath?: string;
};

export function readAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

/**
 * Inline script for the public layout (runs before React, on the landing page): stores UTM
 * parameters, the external referrer and the landing path once per session.
 */
export const ATTRIBUTION_SCRIPT = `try{if(!sessionStorage.getItem("${ATTRIBUTION_KEY}")){var p=new URLSearchParams(location.search),a={},m={utm_source:"utmSource",utm_medium:"utmMedium",utm_campaign:"utmCampaign",utm_term:"utmTerm",utm_content:"utmContent"};for(var k in m){var v=p.get(k);if(v)a[m[k]]=v.slice(0,200)}if(document.referrer&&new URL(document.referrer).host!==location.host)a.referrer=document.referrer.slice(0,500);a.landingPath=location.pathname.slice(0,300);sessionStorage.setItem("${ATTRIBUTION_KEY}",JSON.stringify(a))}}catch(e){}`;
