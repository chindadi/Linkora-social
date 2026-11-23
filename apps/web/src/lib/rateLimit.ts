/**
 * Client-side sliding-window rate limiter backed by sessionStorage.
 *
 * Each action key maps to a JSON array of timestamps (ms since epoch).
 * On every check, timestamps older than `windowMs` are pruned first so the
 * window truly slides and limits reset automatically with no extra cleanup job.
 *
 * Gracefully degrades to "always allowed" when sessionStorage is unavailable
 * (SSR, private-browsing restrictions, quota exceeded), so the UI never breaks.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimit {
  /** Maximum number of actions allowed within the window. */
  maxActions: number;
  /** Duration of the sliding window in milliseconds. */
  windowMs: number;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(key: string): string {
  return `linkora:rl:${key}`;
}

function readTimestamps(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

function writeTimestamps(key: string, timestamps: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(timestamps));
  } catch {
    // sessionStorage unavailable or quota exceeded — degrade silently.
  }
}

/** Prune timestamps that have fallen outside the window. */
function activeTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether the user is allowed to perform another action without
 * recording it. Use `recordAction` afterward if the check passes.
 *
 * Returns `true` when fewer than `limit.maxActions` events exist within
 * the last `limit.windowMs` milliseconds; `false` when the limit is reached.
 *
 * @example
 * ```ts
 * if (!isAllowed("post:submit", { maxActions: 5, windowMs: 60_000 })) {
 *   showError("You are posting too fast.");
 *   return;
 * }
 * ```
 */
export function isAllowed(key: string, limit: RateLimit): boolean {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  const active = activeTimestamps(readTimestamps(key), limit.windowMs, now);
  return active.length < limit.maxActions;
}

/**
 * Record one action for the given key at the current timestamp.
 * Prunes stale entries from storage as a side effect to bound growth.
 *
 * @example
 * ```ts
 * recordAction("post:submit", { maxActions: 5, windowMs: 60_000 });
 * ```
 */
export function recordAction(key: string, limit: RateLimit): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const active = activeTimestamps(readTimestamps(key), limit.windowMs, now);
  writeTimestamps(key, [...active, now]);
}

/**
 * Return the number of additional actions the user may still perform within
 * the current window, or `0` when the limit is already reached.
 *
 * @example
 * ```ts
 * const remaining = getRemainingActions("post:submit", { maxActions: 5, windowMs: 60_000 });
 * // → 3
 * ```
 */
export function getRemainingActions(key: string, limit: RateLimit): number {
  if (typeof window === "undefined") return limit.maxActions;
  const now = Date.now();
  const active = activeTimestamps(readTimestamps(key), limit.windowMs, now);
  return Math.max(0, limit.maxActions - active.length);
}
