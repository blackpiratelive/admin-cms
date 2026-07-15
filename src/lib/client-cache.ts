/**
 * Utility for safe browser localStorage caching with Stale-While-Revalidate (SWR) support.
 */

export function getBrowserCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to read browser cache for key "${key}":`, err);
    return null;
  }
}

export function setBrowserCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to write browser cache for key "${key}":`, err);
  }
}

export function clearBrowserCachePrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn(`Failed to clear browser cache for prefix "${prefix}":`, err);
  }
}
