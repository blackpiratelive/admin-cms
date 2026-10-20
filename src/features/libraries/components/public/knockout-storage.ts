import {
  isValidKnockoutState,
  type KnockoutState,
} from "@/features/libraries/collection-knockout";

const RUN_KEY_PREFIX = "best-pic-knockout:v1:";
const SESSION_KEY = "best-pic-knockout:session:v1";
const SESSION_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function knockoutStorageKey(collectionId: string): string {
  return `${RUN_KEY_PREFIX}${collectionId}`;
}

export function loadKnockoutState(collectionId: string): KnockoutState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(knockoutStorageKey(collectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidKnockoutState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveKnockoutState(state: KnockoutState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(knockoutStorageKey(state.collectionId), JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private browsing; the bracket still works for this visit.
  }
}

export function clearKnockoutState(collectionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(knockoutStorageKey(collectionId));
  } catch {
    // Ignore.
  }
}

export function getKnockoutSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && SESSION_PATTERN.test(existing)) return existing;
    const generated = createRandomToken("ko");
    window.localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return createRandomToken("ko");
  }
}

export function createKnockoutSeed(): string {
  return createRandomToken("seed");
}

function createRandomToken(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
    }
  } catch {
    // Fall through to the Math.random fallback.
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
