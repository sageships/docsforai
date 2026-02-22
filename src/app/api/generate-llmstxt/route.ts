import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { crawlDocs, type CrawlResult } from '@/lib/crawler';
import { generateLlmsTxt } from '@/lib/llmstxt-generator';
import prisma from '@/lib/prisma';

interface GenerateRequestBody {
  url?: string;
  scanId?: string;
}

interface GenerateResponse {
  llmsTxt: string;
  llmsFullTxt: string;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, scanId } = body;

  if (!url && !scanId) {
    return NextResponse.json({ error: 'Either url or scanId is required' }, { status: 400 });
  }

  // ── Path 1: Use existing scan data ─────────────────────────────────────────
  if (scanId) {
    if (typeof scanId !== 'string' || scanId.trim() === '') {
      return NextResponse.json({ error: 'scanId must be a non-empty string' }, { status: 400 });
    }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database error';
      return NextResponse.json({ error: `Database error: ${message}` }, { status: 500 });
    }

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (scan.status !== 'completed') {
      return NextResponse.json(
        { error: `Scan is not completed yet (status: ${scan.status})` },
        { status: 409 },
      );
    }

    // Parse llmsFullTxt and crawlData from metadata
    const meta = safeJsonParse<Record<string, unknown>>(scan.metadata);
    const llmsFullTxt = (meta?.llmsFullTxt as string | null) ?? null;
    const crawlData = meta?.crawlData ?? null;

    // If llms.txt was already generated and stored, return it directly
    if (scan.llmsTxt && llmsFullTxt) {
      const response: GenerateResponse = {
        llmsTxt: scan.llmsTxt,
        llmsFullTxt,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Otherwise re-generate from crawl data (shouldn't happen normally)
    const parsedCrawlData = safeJsonParse<Partial<CrawlResult>>(crawlData);
    if (!parsedCrawlData) {
      return NextResponse.json(
        { error: 'Scan data is incomplete — please run a fresh scan' },
        { status: 422 },
      );
    }

    // Rebuild a minimal CrawlResult from stored meta + re-crawl pages
    // Since we don't store full pages in crawlData (too large), do a fresh crawl
    try {
      const freshCrawl = await crawlDocs(scan.url);
      const { llmsTxt: newLlmsTxt, llmsFullTxt: newLlmsFullTxt } = generateLlmsTxt(freshCrawl);

      // Cache the result back to the scan (merge into existing metadata)
      await prisma.scan
        .update({
          where: { id: scanId.trim() },
          data: {
            llmsTxt: newLlmsTxt,
            metadata: {
              ...(meta ?? {}),
              llmsFullTxt: newLlmsFullTxt,
            },
          },
        })
        .catch(() => {
          // Non-fatal — ignore cache update failure
        });

      const response: GenerateResponse = { llmsTxt: newLlmsTxt, llmsFullTxt: newLlmsFullTxt };
      return NextResponse.json(response, { status: 200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Crawl error';
      return NextResponse.json({ error: `Failed to generate: ${message}` }, { status: 500 });
    }
  }

  // ── Path 2: Fresh crawl from URL ───────────────────────────────────────────
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url must be a non-empty string' }, { status: 400 });
  }

  const normalizedUrl = url.trim();

  if (!isValidUrl(normalizedUrl)) {
    return NextResponse.json({ error: 'url must be a valid http or https URL' }, { status: 400 });
  }

  try {
    const crawlResult = await crawlDocs(normalizedUrl);
    const { llmsTxt, llmsFullTxt } = generateLlmsTxt(crawlResult);

    const response: GenerateResponse = { llmsTxt, llmsFullTxt };
    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to crawl and generate llms.txt: ${message}` },
      { status: 500 },
    );
  }
}
