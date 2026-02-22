import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { syncClerkUser } from '@/lib/clerk-sync';
import { crawlDocs } from '@/lib/crawler';
import { generateLlmsTxt } from '@/lib/llmstxt-generator';
import prisma from '@/lib/prisma';
import { generateRecommendations } from '@/lib/recommendations';
import { scoreDocs } from '@/lib/scorer';

// TODO: Add rate limiting to this endpoint before production.
// Recommended: use Upstash Redis + @upstash/ratelimit to enforce per-IP limits
// (e.g., 5 scans/hour per IP). Without this, a single user can exhaust crawl
// capacity and incur unbounded database writes.

interface ScanRequestBody {
  url: string;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Resolve authenticated user (optional) ──────────────────────────────────
  const { userId: clerkUserId } = await auth();

  let dbUserId: string | null = null;
  if (clerkUserId) {
    try {
      const dbUser = await syncClerkUser(clerkUserId);
      dbUserId = dbUser.id;
    } catch {
      // Non-fatal: proceed as anonymous scan if sync fails
    }
  }

  // ── Parse & validate body ──────────────────────────────────────────────────
  let body: ScanRequestBody;
  try {
    body = (await request.json()) as ScanRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const normalizedUrl = url.trim();

  if (!isValidUrl(normalizedUrl)) {
    return NextResponse.json({ error: 'url must be a valid http or https URL' }, { status: 400 });
  }

  // ── Create pending scan record ──────────────────────────────────────────────
  let scan: { id: string };
  try {
    scan = await prisma.scan.create({
      data: {
        url: normalizedUrl,
        status: 'pending',
        ...(dbUserId ? { userId: dbUserId } : {}),
      },
      select: { id: true },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: `Failed to create scan: ${message}` }, { status: 500 });
  }

  // ── Run pipeline ────────────────────────────────────────────────────────────
  try {
    // 1. Crawl
    const crawlResult = await crawlDocs(normalizedUrl);

    // 2. Score
    const scoreResult = scoreDocs(crawlResult);

    // 3. Recommendations
    const recommendations = generateRecommendations(scoreResult, crawlResult);

    // 4. Generate llms.txt
    const { llmsTxt, llmsFullTxt } = generateLlmsTxt(crawlResult);

    // 5. Persist results — store non-schema fields inside `metadata` Json
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: 'completed',
        overallScore: scoreResult.total,
        structureScore: scoreResult.structure.score,
        codeScore: scoreResult.code.score,
        queryScore: scoreResult.query.score,
        seoScore: scoreResult.seoForAi.score,
        freshnessScore: scoreResult.freshness.score,
        recommendations: JSON.parse(JSON.stringify(recommendations)),
        llmsTxt,
        pagesCrawled: crawlResult.pages.length,
        metadata: JSON.parse(
          JSON.stringify({
            llmsFullTxt,
            scoreBreakdown: scoreResult,
            crawlData: {
              rootUrl: crawlResult.rootUrl,
              hasLlmsTxt: crawlResult.hasLlmsTxt,
              hasLlmsFullTxt: crawlResult.hasLlmsFullTxt,
              hasSitemap: crawlResult.hasSitemap,
              hasRssFeed: crawlResult.hasRssFeed,
              docsStructure: crawlResult.docsStructure,
              errors: crawlResult.errors,
            },
          }),
        ),
      },
    });

    return NextResponse.json(
      {
        scanId: scan.id,
        redirectUrl: `/results/${scan.id}`,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during scan';

    // Mark scan as failed — store error in metadata Json
    try {
      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'failed',
          metadata: { errorMessage: message },
        },
      });
    } catch {
      // Ignore secondary DB error
    }

    return NextResponse.json(
      { error: `Scan failed: ${message}`, scanId: scan.id },
      { status: 500 },
    );
  }
}
