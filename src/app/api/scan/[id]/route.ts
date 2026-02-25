import { auth } from '@clerk/nextjs/server';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeJsonParse } from '@/lib/json-utils';
import prisma from '@/lib/prisma';
import type { Recommendation } from '@/lib/recommendations';
import type { ScoreResult } from '@/lib/scorer';

interface RouteParams {
  params: Promise<{ id: string }>;
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
    isSpa?: boolean;
    spaNote?: string;
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

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;

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
    userId: string | null;
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
        userId: true,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 });
  }

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  // If this scan belongs to a user, only that user may view full results.
  // Anonymous scans (userId=null) remain publicly accessible.
  if (scan.userId) {
    const { userId: clerkUserId } = await auth();
    let requestingUserId: string | null = null;

    if (clerkUserId) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { clerkId: clerkUserId },
          select: { id: true },
        });
        requestingUserId = dbUser?.id ?? null;
      } catch {
        // Ignore — treat as unauthenticated
      }
    }

    if (requestingUserId !== scan.userId) {
      // Return 404 (not 403) to avoid leaking existence of the scan
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }
  }

  // ── Parse metadata ─────────────────────────────────────────────────────────
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
