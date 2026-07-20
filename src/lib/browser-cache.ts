/**
 * Utility helper for SWR Browser Storage Caching (sessionStorage / localStorage).
 * Caches JSON payloads in the user's browser with a specified Time-To-Live (TTL).
 */

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 Minutes TTL

interface CachedPayload<T> {
  timestamp: number;
  data: T;
}

export function getBrowserCache<T>(key: string, customTtlMs = DEFAULT_TTL_MS): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(`cms_cache_${key}`);
    if (!raw) return null;

    const parsed: CachedPayload<T> = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > customTtlMs) {
      sessionStorage.removeItem(`cms_cache_${key}`);
      return null;
    }

    return parsed.data;
  } catch (err) {
    return null;
  }
}

export function setBrowserCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    const payload: CachedPayload<T> = {
      timestamp: Date.now(),
      data,
    };
    sessionStorage.setItem(`cms_cache_${key}`, JSON.stringify(payload));
  } catch (err) {
    // SessionStorage quota exceeded or disabled
  }
}

export function clearBrowserCache(keyPrefix = ""): void {
  if (typeof window === "undefined") return;

  try {
    if (!keyPrefix) {
      sessionStorage.clear();
      return;
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`cms_cache_${keyPrefix}`)) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    // Ignore
  }
}
