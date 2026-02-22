export type ScanStatus = 'pending' | 'crawling' | 'scoring' | 'completed' | 'failed';

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

export interface Scan {
  id: string;
  url: string;
  status: ScanStatus;
  score: number | null;
  scoreBreakdown: ScoreBreakdown[] | null;
  recommendations: Recommendation[] | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
  pagesCrawled: number;
  totalPages: number | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  error: string | null;
}
