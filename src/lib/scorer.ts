import type { CrawlResult, CrawledPage } from './crawler';

export interface ScoreBreakdown {
  score: number;
  maxScore: number;
  reasons: string[];
}

export interface ScoreResult {
  total: number;
  structure: ScoreBreakdown;
  code: ScoreBreakdown;
  query: ScoreBreakdown;
  seoForAi: ScoreBreakdown;
  freshness: ScoreBreakdown;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Structure (0-20) ────────────────────────────────────────────────────────

function scoreStructure(pages: CrawledPage[]): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  if (pages.length === 0) {
    return { score: 0, maxScore: 20, reasons: ['No pages crawled'] };
  }

  // 1. Clear heading hierarchy (h1 > h2 > h3) — up to 5 pts
  const pagesWithGoodHierarchy = pages.filter((p) => {
    const levels = p.headings.map((h) => h.level);
    const hasH1 = levels.includes(1);
    const hasH2 = levels.includes(2);
    return hasH1 && hasH2;
  });
  const hierarchyRatio = pagesWithGoodHierarchy.length / pages.length;
  const hierarchyScore = Math.round(hierarchyRatio * 5);
  score += hierarchyScore;
  if (hierarchyRatio >= 0.8) {
    reasons.push(
      `✅ ${Math.round(hierarchyRatio * 100)}% of pages have clear heading hierarchy (h1 > h2)`,
    );
  } else {
    reasons.push(
      `⚠️ Only ${Math.round(hierarchyRatio * 100)}% of pages have clear heading hierarchy`,
    );
  }

  // 2. Bullet points and numbered lists — up to 4 pts
  const pagesWithLists = pages.filter((p) => p.hasBulletLists || p.hasNumberedLists);
  const listRatio = pagesWithLists.length / pages.length;
  const listScore = Math.round(listRatio * 4);
  score += listScore;
  if (listRatio >= 0.7) {
    reasons.push(`✅ ${Math.round(listRatio * 100)}% of pages use bullet or numbered lists`);
  } else {
    reasons.push(
      `⚠️ Only ${Math.round(listRatio * 100)}% of pages use lists for structured content`,
    );
  }

  // 3. Tables for structured data — up to 3 pts
  const pagesWithTables = pages.filter((p) => p.hasTables);
  const tableRatio = pagesWithTables.length / pages.length;
  const tableScore = tableRatio >= 0.2 ? (tableRatio >= 0.5 ? 3 : 2) : tableRatio > 0 ? 1 : 0;
  score += tableScore;
  if (tableRatio > 0) {
    reasons.push(`✅ ${Math.round(tableRatio * 100)}% of pages use tables for structured data`);
  } else {
    reasons.push(
      '❌ No tables found — consider using tables for API parameters, options, comparisons',
    );
  }

  // 4. Consistent page structure — up to 4 pts
  const headingCounts = pages.map((p) => p.headings.length);
  const meanHeadings = avg(headingCounts);
  const variance = avg(headingCounts.map((c) => Math.pow(c - meanHeadings, 2)));
  const stdDev = Math.sqrt(variance);
  const consistencyScore = stdDev <= 3 ? 4 : stdDev <= 6 ? 3 : stdDev <= 10 ? 2 : 1;
  score += consistencyScore;
  if (stdDev <= 3) {
    reasons.push('✅ Pages have very consistent structure');
  } else if (stdDev > 10) {
    reasons.push('⚠️ Pages have inconsistent structure — heading count varies widely');
  }

  // 5. Good heading-to-content ratio — up to 4 pts
  const pagesWithGoodRatio = pages.filter((p) => {
    const words = p.textContent.split(/\s+/).length;
    const headings = p.headings.length;
    if (headings === 0) return false;
    const ratio = words / headings;
    return ratio >= 50 && ratio <= 400;
  });
  const ratioScore = Math.round((pagesWithGoodRatio.length / pages.length) * 4);
  score += ratioScore;
  if (pagesWithGoodRatio.length / pages.length >= 0.7) {
    reasons.push('✅ Good heading-to-content ratio across pages');
  } else {
    reasons.push('⚠️ Some pages have too few headings relative to content length');
  }

  return { score: clamp(score, 0, 20), maxScore: 20, reasons };
}

// ─── Code (0-20) ─────────────────────────────────────────────────────────────

function scoreCode(pages: CrawledPage[]): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  if (pages.length === 0) {
    return { score: 0, maxScore: 20, reasons: ['No pages crawled'] };
  }

  const allBlocks = pages.flatMap((p) => p.codeBlocks.filter((c) => !c.isInline));
  const allInline = pages.flatMap((p) => p.codeBlocks.filter((c) => c.isInline));

  // 1. Code blocks with language tags — up to 5 pts
  const taggedBlocks = allBlocks.filter((b) => b.language !== null);
  const tagRatio = allBlocks.length > 0 ? taggedBlocks.length / allBlocks.length : 0;
  const tagScore = Math.round(tagRatio * 5);
  score += tagScore;
  if (tagRatio >= 0.8) {
    reasons.push(`✅ ${Math.round(tagRatio * 100)}% of code blocks have language tags`);
  } else if (allBlocks.length === 0) {
    reasons.push('❌ No code blocks found in documentation');
  } else {
    reasons.push(
      `⚠️ Only ${Math.round(tagRatio * 100)}% of code blocks have language tags (${taggedBlocks.length}/${allBlocks.length})`,
    );
  }

  // 2. Copy buttons / fenced blocks — up to 4 pts
  const copyableBlocks = allBlocks.filter((b) => b.hasCopyButton);
  const copyRatio = allBlocks.length > 0 ? copyableBlocks.length / allBlocks.length : 0;
  const copyScore = copyRatio >= 0.5 ? 4 : copyRatio >= 0.2 ? 2 : copyRatio > 0 ? 1 : 0;
  score += copyScore;
  if (copyRatio >= 0.5) {
    reasons.push('✅ Most code blocks have copy buttons');
  } else {
    reasons.push('⚠️ Few or no copy buttons on code blocks — consider adding them');
  }

  // 3. Mix of inline and block code — up to 3 pts
  const hasMix = allBlocks.length > 0 && allInline.length > 0;
  score += hasMix ? 3 : allBlocks.length > 0 ? 1 : 0;
  if (hasMix) {
    reasons.push('✅ Good mix of inline code and code blocks');
  } else {
    reasons.push('⚠️ Missing mix of inline and block code examples');
  }

  // 4. Code examples per page ratio — up to 4 pts
  const pagesWithCode = pages.filter((p) => p.codeBlocks.some((c) => !c.isInline));
  const codePageRatio = pagesWithCode.length / pages.length;
  const codePageScore = Math.round(codePageRatio * 4);
  score += codePageScore;
  if (codePageRatio >= 0.7) {
    reasons.push(`✅ ${Math.round(codePageRatio * 100)}% of pages include code examples`);
  } else {
    reasons.push(`⚠️ Only ${Math.round(codePageRatio * 100)}% of pages include code examples`);
  }

  // 5. Complete/runnable examples — up to 4 pts
  // Heuristic: code blocks > 5 lines that aren't just shell fragments
  const completeExamples = allBlocks.filter((b) => {
    const lines = b.code.split('\n').length;
    return lines >= 5;
  });
  const completeRatio = allBlocks.length > 0 ? completeExamples.length / allBlocks.length : 0;
  const completeScore =
    completeRatio >= 0.3 ? 4 : completeRatio >= 0.15 ? 2 : completeRatio > 0 ? 1 : 0;
  score += completeScore;
  if (completeRatio >= 0.3) {
    reasons.push('✅ Good number of complete, multi-line code examples');
  } else {
    reasons.push('⚠️ Most code examples are short fragments — add complete runnable examples');
  }

  return { score: clamp(score, 0, 20), maxScore: 20, reasons };
}

// ─── Query (0-20) ─────────────────────────────────────────────────────────────

function scoreQuery(pages: CrawledPage[]): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  if (pages.length === 0) {
    return { score: 0, maxScore: 20, reasons: ['No pages crawled'] };
  }

  const allTitles = pages.map((p) => p.title.toLowerCase());
  const allHeadingTexts = pages.flatMap((p) => p.headings.map((h) => h.text.toLowerCase()));

  // 1. Pages answer "how to" questions — up to 4 pts
  const howToKeywords = [
    'how to',
    'how do i',
    'how can',
    'step-by-step',
    'tutorial',
    'guide',
    'walkthrough',
  ];
  const howToPages = pages.filter(
    (p) =>
      howToKeywords.some((kw) => p.title.toLowerCase().includes(kw)) ||
      p.headings.some((h) => howToKeywords.some((kw) => h.text.toLowerCase().includes(kw))),
  );
  const howToRatio = howToPages.length / pages.length;
  const howToScore = howToRatio >= 0.2 ? 4 : howToRatio >= 0.1 ? 2 : howToRatio > 0 ? 1 : 0;
  score += howToScore;
  if (howToRatio >= 0.2) {
    reasons.push(`✅ ${howToPages.length} pages answer "how to" questions directly`);
  } else {
    reasons.push('⚠️ Few pages are structured as "how to" guides — add task-oriented content');
  }

  // 2. Getting started / quickstart guide — up to 4 pts
  const quickstartKeywords = [
    'getting started',
    'quickstart',
    'quick start',
    'introduction',
    'installation',
    'setup',
    'first steps',
  ];
  const hasQuickstart =
    allTitles.some((t) => quickstartKeywords.some((kw) => t.includes(kw))) ||
    allHeadingTexts.some((t) => quickstartKeywords.some((kw) => t.includes(kw)));
  score += hasQuickstart ? 4 : 0;
  if (hasQuickstart) {
    reasons.push('✅ Has a getting started / quickstart guide');
  } else {
    reasons.push(
      '❌ No getting started or quickstart guide found — this is critical for AI agents',
    );
  }

  // 3. API reference with parameters documented — up to 4 pts
  const apiKeywords = [
    'api reference',
    'api docs',
    'endpoint',
    'parameter',
    'parameters',
    'request',
    'response',
    'method',
  ];
  const hasApiRef =
    allTitles.some((t) => apiKeywords.some((kw) => t.includes(kw))) ||
    allHeadingTexts.some((t) => apiKeywords.some((kw) => t.includes(kw)));
  const hasTables = pages.some((p) => p.hasTables);
  const apiScore = hasApiRef ? (hasTables ? 4 : 2) : 0;
  score += apiScore;
  if (hasApiRef && hasTables) {
    reasons.push('✅ API reference with tables documenting parameters');
  } else if (hasApiRef) {
    reasons.push('⚠️ Has API reference but could use parameter tables');
  } else {
    reasons.push('❌ No API reference section found');
  }

  // 4. Content self-containment — up to 4 pts
  // Heuristic: pages with more words tend to be more self-contained
  const avgWords = avg(pages.map((p) => p.textContent.split(/\s+/).length));
  const selfContainedScore = avgWords >= 400 ? 4 : avgWords >= 200 ? 3 : avgWords >= 100 ? 2 : 1;
  score += selfContainedScore;
  if (avgWords >= 400) {
    reasons.push('✅ Pages appear self-contained with sufficient content');
  } else {
    reasons.push(
      `⚠️ Pages may be too thin (avg ~${Math.round(avgWords)} words) — ensure content is self-contained`,
    );
  }

  // 5. Summaries / TLDRs — up to 4 pts
  const summaryKeywords = [
    'summary',
    'tldr',
    'tl;dr',
    'overview',
    'at a glance',
    'in this guide',
    'in this article',
  ];
  const pagesWithSummary = pages.filter(
    (p) =>
      summaryKeywords.some((kw) => p.title.toLowerCase().includes(kw)) ||
      p.headings.some((h) => summaryKeywords.some((kw) => h.text.toLowerCase().includes(kw))) ||
      summaryKeywords.some((kw) => p.textContent.toLowerCase().slice(0, 500).includes(kw)),
  );
  const summaryRatio = pagesWithSummary.length / pages.length;
  const summaryScore = summaryRatio >= 0.3 ? 4 : summaryRatio >= 0.1 ? 2 : summaryRatio > 0 ? 1 : 0;
  score += summaryScore;
  if (summaryRatio >= 0.3) {
    reasons.push(`✅ ${Math.round(summaryRatio * 100)}% of pages include summaries or overviews`);
  } else {
    reasons.push(
      '⚠️ Few pages have summaries — add TLDR sections to help AI agents extract key info',
    );
  }

  return { score: clamp(score, 0, 20), maxScore: 20, reasons };
}

// ─── SEO for AI (0-20) ───────────────────────────────────────────────────────

function scoreSeoForAi(crawl: CrawlResult): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;
  const { pages } = crawl;

  // 1. /llms.txt — up to 5 pts
  score += crawl.hasLlmsTxt ? 5 : 0;
  if (crawl.hasLlmsTxt) {
    reasons.push('✅ /llms.txt found — excellent AI discoverability');
  } else {
    reasons.push('❌ No /llms.txt — this is the single most impactful thing to add');
  }

  // 2. /llms-full.txt — up to 4 pts
  score += crawl.hasLlmsFullTxt ? 4 : 0;
  if (crawl.hasLlmsFullTxt) {
    reasons.push('✅ /llms-full.txt found');
  } else {
    reasons.push('❌ No /llms-full.txt — add full-text version for AI context ingestion');
  }

  // 3. Pages available as .md — up to 4 pts
  const pagesWithMd = pages.filter((p) => p.hasMarkdownVersion);
  const mdRatio = pages.length > 0 ? pagesWithMd.length / pages.length : 0;
  const mdScore = mdRatio >= 0.5 ? 4 : mdRatio >= 0.2 ? 2 : mdRatio > 0 ? 1 : 0;
  score += mdScore;
  if (mdRatio >= 0.5) {
    reasons.push(`✅ ${Math.round(mdRatio * 100)}% of pages have .md equivalents`);
  } else if (mdRatio > 0) {
    reasons.push(`⚠️ Only ${Math.round(mdRatio * 100)}% of pages have .md versions`);
  } else {
    reasons.push('❌ No .md versions of pages — AI agents prefer plain markdown');
  }

  // 4. Structured metadata — up to 4 pts
  const pagesWithMeta = pages.filter((p) => p.metaDescription || p.hasOpenGraph);
  const metaRatio = pages.length > 0 ? pagesWithMeta.length / pages.length : 0;
  const metaScore = Math.round(metaRatio * 4);
  score += metaScore;
  if (metaRatio >= 0.8) {
    reasons.push(
      `✅ ${Math.round(metaRatio * 100)}% of pages have meta descriptions or OpenGraph tags`,
    );
  } else {
    reasons.push(`⚠️ Only ${Math.round(metaRatio * 100)}% of pages have structured metadata`);
  }

  // 5. sitemap.xml — up to 3 pts
  score += crawl.hasSitemap ? 3 : 0;
  if (crawl.hasSitemap) {
    reasons.push('✅ sitemap.xml found');
  } else {
    reasons.push('❌ No sitemap.xml — add one to help AI crawlers discover all pages');
  }

  return { score: clamp(score, 0, 20), maxScore: 20, reasons };
}

// ─── Freshness (0-20) ────────────────────────────────────────────────────────

function scoreFreshness(crawl: CrawlResult): ScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;
  const { pages } = crawl;

  // 1. Last-modified headers — up to 5 pts
  const pagesWithLastModified = pages.filter((p) => p.lastModified !== null);
  const lmRatio = pages.length > 0 ? pagesWithLastModified.length / pages.length : 0;
  const lmScore = Math.round(lmRatio * 5);
  score += lmScore;
  if (lmRatio >= 0.7) {
    reasons.push(`✅ ${Math.round(lmRatio * 100)}% of pages include Last-Modified headers`);
  } else {
    reasons.push(
      `⚠️ Only ${Math.round(lmRatio * 100)}% of pages have Last-Modified headers — helps AI assess staleness`,
    );
  }

  // 2. Version/changelog visible — up to 4 pts
  const changelogKeywords = [
    'changelog',
    'release notes',
    "what's new",
    'version',
    'releases',
    'migration',
    'upgrade',
  ];
  const allText = pages.map(
    (p) =>
      p.title.toLowerCase() +
      ' ' +
      p.headings
        .map((h) => h.text)
        .join(' ')
        .toLowerCase(),
  );
  const hasChangelog = allText.some((t) => changelogKeywords.some((kw) => t.includes(kw)));
  score += hasChangelog ? 4 : 0;
  if (hasChangelog) {
    reasons.push('✅ Changelog or release notes found');
  } else {
    reasons.push('❌ No changelog or release notes — add one so AI knows how current the docs are');
  }

  // 3. Copyright year current — up to 3 pts
  const currentYear = new Date().getFullYear();
  const allPageText = pages.map((p) => p.textContent).join(' ');
  const hasCurrentYear = allPageText.includes(String(currentYear));
  const hasLastYear = allPageText.includes(String(currentYear - 1));
  const yearScore = hasCurrentYear ? 3 : hasLastYear ? 2 : 0;
  score += yearScore;
  if (hasCurrentYear) {
    reasons.push(`✅ Current year (${currentYear}) present in content`);
  } else {
    reasons.push(`⚠️ Current year (${currentYear}) not found — update copyright/version dates`);
  }

  // 4. No broken links — up to 4 pts
  const errorUrls = new Set(crawl.errors.map((e) => e.url));
  const brokenLinks = pages.flatMap((p) => p.links).filter((link) => errorUrls.has(link));
  const brokenCount = brokenLinks.length;
  const brokenScore =
    brokenCount === 0 ? 4 : brokenCount <= 2 ? 3 : brokenCount <= 5 ? 2 : brokenCount <= 10 ? 1 : 0;
  score += brokenScore;
  if (brokenCount === 0) {
    reasons.push('✅ No broken links detected in sample');
  } else {
    reasons.push(`⚠️ ${brokenCount} broken links detected — fix these to maintain trust`);
  }

  // 5. RSS/changelog feed — up to 4 pts
  score += crawl.hasRssFeed ? 4 : 0;
  if (crawl.hasRssFeed) {
    reasons.push('✅ RSS/changelog feed found');
  } else {
    reasons.push('❌ No RSS feed — add /feed.xml or /rss.xml so AI can track updates');
  }

  return { score: clamp(score, 0, 20), maxScore: 20, reasons };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function scoreDocs(crawl: CrawlResult): ScoreResult {
  const structure = scoreStructure(crawl.pages);
  const code = scoreCode(crawl.pages);
  const query = scoreQuery(crawl.pages);
  const seoForAi = scoreSeoForAi(crawl);
  const freshness = scoreFreshness(crawl);

  const total = structure.score + code.score + query.score + seoForAi.score + freshness.score;

  return {
    total: clamp(total, 0, 100),
    structure,
    code,
    query,
    seoForAi,
    freshness,
  };
}
