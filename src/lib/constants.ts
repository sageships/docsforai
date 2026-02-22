/**
 * Application-wide constants for DocsForAI.
 * Centralises magic numbers and configuration to a single source of truth.
 */

// ─── Crawler ─────────────────────────────────────────────────────────────────

/** Maximum number of pages the crawler will process per scan. */
export const MAX_PAGES = 50;

/** Default HTTP request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Quick-check HTTP timeout (used for HEAD requests). */
export const QUICK_CHECK_TIMEOUT_MS = 5_000;

/** Maximum characters of text content extracted per page. */
export const MAX_TEXT_CONTENT_CHARS = 5_000;

/** User-Agent header sent by the crawler. */
export const CRAWLER_USER_AGENT =
  'DocsForAI-Crawler/1.0 (https://docsforai.com; scanning for AI readiness)';

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Maximum score for each scoring dimension. */
export const MAX_DIMENSION_SCORE = 20;

/** Total maximum score across all dimensions (5 × 20). */
export const MAX_TOTAL_SCORE = 100;

/** Ratio of pages that must have a good heading hierarchy to score well. */
export const HEADING_HIERARCHY_GOOD_RATIO = 0.8;

/** Ratio of pages using lists to score well. */
export const LIST_RATIO_GOOD = 0.7;

/** Minimum ratio of pages with tables to get partial credit. */
export const TABLE_RATIO_MIN = 0.2;

/** Ratio of code-tagged blocks to score full points. */
export const CODE_TAG_RATIO_GOOD = 0.8;

/** Minimum lines in a code block to be considered "complete". */
export const MIN_COMPLETE_CODE_LINES = 5;

/** Minimum word count for a page to be considered "self-contained". */
export const MIN_WORDS_SELF_CONTAINED = 100;

/** Minimum words for a "good" self-contained page. */
export const GOOD_WORDS_SELF_CONTAINED = 400;

// ─── Polling ──────────────────────────────────────────────────────────────────

/** Interval between scan-status poll requests (ms). */
export const POLL_INTERVAL_MS = 2_000;

/** Maximum number of poll attempts before timing out (~5 minutes). */
export const MAX_POLL_ATTEMPTS = 150;

// ─── Score thresholds ────────────────────────────────────────────────────────

/** Score below this is "needs work" (red). */
export const SCORE_THRESHOLD_LOW = 40;

/** Score below this is "moderate" (yellow). */
export const SCORE_THRESHOLD_MID = 70;

// ─── Recommendation filtering ────────────────────────────────────────────────

/** Recommendations are only shown for categories that score below this. */
export const REC_SCORE_THRESHOLD = 15;
