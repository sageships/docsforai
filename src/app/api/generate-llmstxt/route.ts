import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { SCAN_STATUS } from '@/lib/constants';
import { crawlDocs, type CrawlResult } from '@/lib/crawler';
import { safeJsonParse } from '@/lib/json-utils';
import { generateLlmsTxt } from '@/lib/llmstxt-generator';
import prisma from '@/lib/prisma';
import { GenerateLlmsTxtRequestSchema } from '@/lib/schemas';
import { isPublicUrl } from '@/lib/url-validator';

interface GenerateResponse {
  llmsTxt: string;
  llmsFullTxt: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse & validate body ──────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = GenerateLlmsTxtRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { url, scanId } = parsed.data;

  // ── Path 1: Use existing scan data ─────────────────────────────────────────
  if (scanId) {
    let scan: {
      status: string;
      llmsTxt: string | null;
      metadata: Prisma.JsonValue;
      url: string;
    } | null;

    try {
      scan = await prisma.scan.findUnique({
        where: { id: scanId.trim() },
        select: {
          status: true,
          llmsTxt: true,
          metadata: true,
          url: true,
        },
      });
    } catch {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (scan.status !== SCAN_STATUS.COMPLETED) {
      return NextResponse.json(
        { error: `Scan is not completed yet (status: ${scan.status})` },
        { status: 409 },
      );
    }

    // Parse llmsFullTxt from metadata
    const meta = safeJsonParse<Record<string, unknown>>(scan.metadata);
    const llmsFullTxt = (meta?.llmsFullTxt as string | null) ?? null;

    // If already generated, return directly
    if (scan.llmsTxt && llmsFullTxt) {
      const response: GenerateResponse = {
        llmsTxt: scan.llmsTxt,
        llmsFullTxt,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Missing data — instruct user to re-run rather than silently re-crawling
    return NextResponse.json(
      {
        error: 'llms.txt data is missing for this scan. Please run a fresh scan to regenerate it.',
      },
      { status: 422 },
    );
  }

  // ── Path 2: Fresh crawl from URL ───────────────────────────────────────────
  if (!url) {
    return NextResponse.json({ error: 'url must be a non-empty string' }, { status: 400 });
  }

  const normalizedUrl = url.trim();

  if (!isPublicUrl(normalizedUrl)) {
    return NextResponse.json(
      { error: 'url must be a valid, publicly-routable http or https URL' },
      { status: 400 },
    );
  }

  try {
    const crawlResult: CrawlResult = await crawlDocs(normalizedUrl);
    const { llmsTxt, llmsFullTxt } = generateLlmsTxt(crawlResult);

    const response: GenerateResponse = { llmsTxt, llmsFullTxt };
    return NextResponse.json(response, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to crawl and generate llms.txt' }, { status: 500 });
  }
}
