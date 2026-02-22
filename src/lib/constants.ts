/**
 * Application-wide constants for DocsForAI.
 * Centralises magic numbers, enums, routes, and configuration to a single
 * source of truth. Import from here — never hardcode these values elsewhere.
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

/** Score percentage below this is "needs work" (red zone). */
export const SCORE_THRESHOLD_LOW = 40;

/** Score percentage at or below this is "moderate" (yellow zone). */
export const SCORE_THRESHOLD_MID = 70;

// ─── Recommendation filtering ────────────────────────────────────────────────

/** Recommendations are only shown for categories that score below this. */
export const REC_SCORE_THRESHOLD = 15;

// ─── Scan statuses ───────────────────────────────────────────────────────────

/**
 * All valid scan lifecycle statuses.
 * Use these constants everywhere — never hardcode the string literals.
 */
export const SCAN_STATUS = {
  PENDING: 'pending',
  CRAWLING: 'crawling',
  SCORING: 'scoring',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ScanStatus = (typeof SCAN_STATUS)[keyof typeof SCAN_STATUS];

// ─── Score categories ────────────────────────────────────────────────────────

/**
 * Canonical definitions for each scoring dimension.
 * `key` matches the field name in ScoreResult; `label` is the display name.
 */
export const SCORE_CATEGORIES = {
  STRUCTURE: { key: 'structure' as const, label: 'Structure', icon: '🏗️', maxScore: 20 },
  CODE: { key: 'code' as const, label: 'Code Quality', icon: '💻', maxScore: 20 },
  QUERY: { key: 'query' as const, label: 'Query-ability', icon: '🔍', maxScore: 20 },
  SEO: { key: 'seoForAi' as const, label: 'AI-SEO', icon: '🤖', maxScore: 20 },
  FRESHNESS: { key: 'freshness' as const, label: 'Freshness', icon: '⚡', maxScore: 20 },
} as const;

/** Union of all scorer field keys ('structure' | 'code' | 'query' | 'seoForAi' | 'freshness'). */
export type CategoryKey = (typeof SCORE_CATEGORIES)[keyof typeof SCORE_CATEGORIES]['key'];

// ─── Priority levels ──────────────────────────────────────────────────────────

/** Recommendation priority levels. */
export const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

// ─── API routes ───────────────────────────────────────────────────────────────

/** Centralised API route paths. Change once here, propagates everywhere. */
export const API_ROUTES = {
  SCAN: '/api/scan',
  SCANS: '/api/scans',
  SCAN_BY_ID: (id: string) => `/api/scan/${id}`,
  GENERATE_LLMSTXT: '/api/generate-llmstxt',
};

// ─── Score colours ────────────────────────────────────────────────────────────

/**
 * Shared colour utilities for score display.
 * All threshold comparisons live here — never duplicate them in components.
 *
 * Accepts `score` and `max` (defaults to 100 for overall score).
 * Internally converts to a 0–100 percentage before comparing thresholds.
 */
export const SCORE_COLORS = {
  /** Tailwind text colour class (e.g. 'text-red-400'). */
  textClass: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return 'text-red-400';
    if (pct <= SCORE_THRESHOLD_MID) return 'text-yellow-400';
    return 'text-green-400';
  },

  /** Tailwind background colour class for progress bars (e.g. 'bg-red-500'). */
  barClass: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return 'bg-red-500';
    if (pct <= SCORE_THRESHOLD_MID) return 'bg-yellow-500';
    return 'bg-green-500';
  },

  /** Hex colour string for SVG strokes / inline styles (e.g. '#ef4444'). */
  hex: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return '#ef4444'; // red-500
    if (pct <= SCORE_THRESHOLD_MID) return '#eab308'; // yellow-500
    return '#22c55e'; // green-500
  },

  /** Human-readable quality label (e.g. 'Needs Work'). */
  label: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return 'Needs Work';
    if (pct <= SCORE_THRESHOLD_MID) return 'Moderate';
    return 'AI-Ready';
  },

  /** shields.io badge colour name. */
  badgeColor: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return 'critical';
    if (pct <= SCORE_THRESHOLD_MID) return 'yellow';
    return 'brightgreen';
  },

  /** shields.io badge label text. */
  badgeLabel: (score: number, max = 100): string => {
    const pct = (score / max) * 100;
    if (pct < SCORE_THRESHOLD_LOW) return 'needs work';
    if (pct <= SCORE_THRESHOLD_MID) return 'moderate';
    return 'AI-ready';
  },
};
