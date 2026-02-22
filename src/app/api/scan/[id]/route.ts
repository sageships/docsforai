import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import type { Recommendation } from '@/lib/recommendations';
import type { ScoreResult } from '@/lib/scorer';

interface RouteParams {
  params: { id: string };
}

interface ScanResponse {
  id: string;
  url: string;
  status: string;
  totalScore: number | null;
  scores: ScoreResult | null;
  recommendations: Recommendation[] | null;
  llmsTxt: string | null;
  llmsFullTxt: string | null;
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
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function safeJsonParse<T>(value: unknown): T | null {
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

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Scan ID is required' }, { status: 400 });
  }

  let scan: {
    id: string;
    url: string;
    status: string;
    overallScore: number | null;
    recommendations: Prisma.JsonValue;
    llmsTxt: string | null;
    pagesCrawled: number | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  } | null;

  try {
    scan = await prisma.scan.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        status: true,
        overallScore: true,
        recommendations: true,
        llmsTxt: true,
        pagesCrawled: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: `Failed to fetch scan: ${message}` }, { status: 500 });
  }

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Parse fields stored in metadata Json
  const meta = safeJsonParse<Record<string, unknown>>(scan.metadata);
  const llmsFullTxt = (meta?.llmsFullTxt as string | null) ?? null;
  const scoreBreakdown = meta?.scoreBreakdown ?? null;
  const crawlData = meta?.crawlData ?? null;
  const errorMessage = (meta?.errorMessage as string | null) ?? null;

  const response: ScanResponse = {
    id: scan.id,
    url: scan.url,
    status: scan.status,
    totalScore: scan.overallScore,
    scores: safeJsonParse<ScoreResult>(scoreBreakdown),
    recommendations: safeJsonParse<Recommendation[]>(scan.recommendations),
    llmsTxt: scan.llmsTxt,
    llmsFullTxt,
    pagesScanned: scan.pagesCrawled,
    crawlMeta: safeJsonParse<ScanResponse['crawlMeta']>(crawlData),
    errorMessage,
    createdAt: scan.createdAt,
    updatedAt: scan.updatedAt,
  };

  return NextResponse.json(response, { status: 200 });
}
