import { auth } from '@clerk/nextjs/server';
import { after, NextResponse, type NextRequest } from 'next/server';

import { syncClerkUser } from '@/lib/clerk-sync';
import { SCAN_STATUS } from '@/lib/constants';
import { crawlDocs } from '@/lib/crawler';
import { generateLlmsTxt } from '@/lib/llmstxt-generator';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { generateRecommendations } from '@/lib/recommendations';
import { ScanRequestSchema } from '@/lib/schemas';
import { scoreDocs } from '@/lib/scorer';
import { isPublicUrl } from '@/lib/url-validator';

// TODO: Add rate limiting before high-traffic production launch.
// Recommended: Upstash Redis + @upstash/ratelimit for per-IP sliding window.

/**
 * Runs the full crawl → score → recommend → generate pipeline for a scan.
 * Updates scan status at each stage so the polling UI reflects real progress.
 */
async function runScanPipeline(scanId: string, normalizedUrl: string): Promise<void> {
  const log = logger.child({ scanId, url: normalizedUrl });
  try {
    // 1. Crawl
    log.info('Starting crawl');
    await prisma.scan.update({ where: { id: scanId }, data: { status: SCAN_STATUS.CRAWLING } });
    const crawlResult = await crawlDocs(normalizedUrl);

    // 2. Score
    log.info({ pageCount: crawlResult.pages.length }, 'Crawl complete, scoring');
    await prisma.scan.update({ where: { id: scanId }, data: { status: SCAN_STATUS.SCORING } });
    const scoreResult = scoreDocs(crawlResult);

    // 3. Recommendations
    const recommendations = generateRecommendations(scoreResult, crawlResult);

    // 4. Generate llms.txt
    const { llmsTxt, llmsFullTxt } = generateLlmsTxt(crawlResult);

    // 5. Persist results
    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: SCAN_STATUS.COMPLETED,
        completedAt: new Date(),
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error during scan';
    log.error({ err }, 'Scan pipeline failed');

    // Mark scan as failed
    try {
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: SCAN_STATUS.FAILED,
          completedAt: new Date(),
          metadata: { errorMessage: message },
        },
      });
    } catch (dbErr) {
      log.error({ err: dbErr }, 'Failed to mark scan as failed in DB');
    }
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
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ScanRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const normalizedUrl = parsed.data.url.trim();

  if (!isPublicUrl(normalizedUrl)) {
    return NextResponse.json(
      { error: 'url must be a valid, publicly-routable http or https URL' },
      { status: 400 },
    );
  }

  // ── Create pending scan record ──────────────────────────────────────────────
  let scan: { id: string };
  try {
    scan = await prisma.scan.create({
      data: {
        url: normalizedUrl,
        status: SCAN_STATUS.PENDING,
        ...(dbUserId ? { userId: dbUserId } : {}),
      },
      select: { id: true },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 });
  }

  // ── Schedule pipeline to run after response is sent ────────────────────────
  // `after()` runs the callback after the response is delivered, compatible
  // with Vercel's waitUntil. The crawl pipeline runs independently in the
  // background while the client immediately gets back the scanId to poll.
  after(async () => {
    await runScanPipeline(scan.id, normalizedUrl);
  });

  return NextResponse.json(
    {
      scanId: scan.id,
      redirectUrl: `/results/${scan.id}`,
    },
    { status: 201 },
  );
}
