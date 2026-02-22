import type { ScoreResult } from '@/lib/scorer';

export type ScanStatus = 'pending' | 'crawling' | 'scoring' | 'completed' | 'failed';

/**
 * ScoreBreakdown is the per-category view used by the ScoreBreakdown UI component.
 * Each entry wraps a ScoreResult dimension with its display category name.
 */
export interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  reasons: string[];
}

export interface Recommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  example?: string;
}

/**
 * Scan type matches the shape returned by GET /api/scan/[id].
 * Field names here must match the ScanResponse interface in that route.
 */
export interface Scan {
  id: string;
  url: string;
  status: ScanStatus;
  /** Overall 0–100 score. Null if scan is not completed. */
  totalScore: number | null;
  /** Per-dimension score breakdown from the scorer. */
  scores: ScoreResult | null;
  recommendations: Recommendation[] | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  /** Number of pages successfully crawled. */
  pagesScanned: number | null;
  crawlMeta: {
    rootUrl: string;
    hasLlmsTxt: boolean;
    hasLlmsFullTxt: boolean;
    hasSitemap: boolean;
    hasRssFeed: boolean;
    docsStructure: {
      hasSidebar: boolean;
      hasNavigation: boolean;
      hasVersioning: boolean;
      hasSearch: boolean;
    };
    errors: Array<{ url: string; error: string }>;
  } | null;
  /** Error message if status === 'failed'. */
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a ScoreResult (from the scorer) into a ScoreBreakdown array
 * for display in the ScoreBreakdown UI component.
 */
export function scoreResultToBreakdown(scores: ScoreResult): ScoreBreakdown[] {
  return [
    { category: 'Structure', ...scores.structure },
    { category: 'Code Quality', ...scores.code },
    { category: 'Query-ability', ...scores.query },
    { category: 'AI-SEO', ...scores.seoForAi },
    { category: 'Freshness', ...scores.freshness },
  ];
}

/** Lightweight scan summary returned by GET /api/scans (dashboard list). */
export interface ScanSummary {
  id: string;
  url: string;
  status: ScanStatus;
  totalScore: number | null;
  createdAt: string;
}
