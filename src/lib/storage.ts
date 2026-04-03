// ---------------------------------------------------------------------------
// Storage helpers for additional scan paths
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "skill-lens:additionalPaths";

/**
 * Loads the additional scan paths from localStorage.
 * Returns an empty array when called server-side or when nothing is stored.
 */
export function loadAdditionalPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

/**
 * Persists the additional scan paths to localStorage.
 * Silently ignores storage errors.
 */
export function saveAdditionalPaths(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Ignore storage errors
  }
}
