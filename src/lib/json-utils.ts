/**
 * JSON parsing utilities.
 */

/**
 * Safely parses a JSON value that may be a string, object, or null.
 * Returns null if parsing fails.
 */
export function safeJsonParse<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}
