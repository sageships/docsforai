import { PRIORITY, SCORE_CATEGORIES, type CategoryKey, type Priority } from '@/lib/constants';

import type { CrawlResult } from './crawler';
import type { ScoreResult } from './scorer';

// Re-export so existing imports of Priority/Category from this module keep working.
export type { Priority };
export type Category = CategoryKey;

export interface Recommendation {
  category: Category;
  priority: Priority;
  title: string;
  description: string;
  example: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function priorityFromScore(score: number, max: number = 20): Priority {
  const pct = score / max;
  if (pct < 0.5) return PRIORITY.HIGH;
  if (pct < 0.75) return PRIORITY.MEDIUM;
  return PRIORITY.LOW;
}

// ─── Structure recommendations ───────────────────────────────────────────────

function structureRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const { pages } = crawl;
  const { score } = scores.structure;

  // Heading hierarchy
  const pagesWithoutH1 = pages.filter((p) => !p.headings.some((h) => h.level === 1));
  if (pagesWithoutH1.length > 0) {
    const examples = pagesWithoutH1
      .slice(0, 3)
      .map((p) => p.url)
      .join(', ');
    recs.push({
      category: SCORE_CATEGORIES.STRUCTURE.key,
      priority: priorityFromScore(score),
      title: 'Add H1 headings to pages missing them',
      description: `${pagesWithoutH1.length} page(s) lack an H1 heading. A clear H1 anchors the page for both users and AI parsers. Every doc page should start with a single descriptive H1.`,
      example: `Pages missing H1: ${examples}\n\nAdd: <h1>Getting Started with ${crawl.rootUrl}</h1> at the top of each page.`,
    });
  }

  // Tables
  const pagesWithTables = pages.filter((p) => p.hasTables);
  if (pagesWithTables.length / Math.max(pages.length, 1) < 0.2) {
    recs.push({
      category: SCORE_CATEGORIES.STRUCTURE.key,
      priority: PRIORITY.MEDIUM,
      title: 'Add parameter tables to reference pages',
      description:
        'Tables make structured data (API parameters, options, comparisons) easy for AI agents to parse precisely. Without tables, AI must guess parameter types from prose.',
      example:
        '| Parameter | Type | Required | Description |\n|-----------|------|----------|-------------|\n| apiKey | string | Yes | Your API key from the dashboard |\n| timeout | number | No | Request timeout in ms (default: 5000) |',
    });
  }

  // Bullet lists
  const pagesWithoutLists = pages.filter((p) => !p.hasBulletLists && !p.hasNumberedLists);
  if (pagesWithoutLists.length > pages.length * 0.4) {
    const examples = pagesWithoutLists
      .slice(0, 2)
      .map((p) => p.url)
      .join(', ');
    recs.push({
      category: SCORE_CATEGORIES.STRUCTURE.key,
      priority: PRIORITY.LOW,
      title: 'Use lists to break up dense prose sections',
      description: `${pagesWithoutLists.length} pages have no bullet or numbered lists. Lists are easier for AI models to parse than multi-sentence prose containing the same information.`,
      example: `Instead of: "The SDK supports JavaScript, Python, and Go. It works on Linux, macOS, and Windows."\n\nUse:\n- JavaScript\n- Python\n- Go\n\nSupported platforms:\n1. Linux\n2. macOS\n3. Windows\n\nPages to fix: ${examples}`,
    });
  }

  return recs;
}

// ─── Code recommendations ─────────────────────────────────────────────────────

function codeRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const { pages } = crawl;
  const { score } = scores.code;

  // Language tags
  const allBlocks = pages.flatMap((p) => p.codeBlocks.filter((c) => !c.isInline));
  const untaggedBlocks = allBlocks.filter((b) => b.language === null);
  if (untaggedBlocks.length > allBlocks.length * 0.3) {
    // Find pages with untagged blocks
    const pagesWithUntagged = pages
      .filter((p) => p.codeBlocks.some((c) => !c.isInline && c.language === null))
      .slice(0, 3)
      .map((p) => p.url)
      .join('\n  - ');
    recs.push({
      category: SCORE_CATEGORIES.CODE.key,
      priority: priorityFromScore(score),
      title: `Add language tags to ${untaggedBlocks.length} untagged code blocks`,
      description:
        'Language-tagged code blocks allow AI models to understand syntax, provide better completions, and detect errors. Without tags, code is parsed as plain text.',
      example: `Pages to fix:\n  - ${pagesWithUntagged}\n\nChange:\n\`\`\`\nnpm install my-sdk\n\`\`\`\n\nTo:\n\`\`\`bash\nnpm install my-sdk\n\`\`\``,
    });
  }

  // No code at all
  const pagesWithoutCode = pages.filter(
    (p) => p.codeBlocks.filter((c) => !c.isInline).length === 0,
  );
  if (pagesWithoutCode.length > pages.length * 0.5) {
    const examples = pagesWithoutCode
      .slice(0, 3)
      .map((p) => p.url)
      .join('\n  - ');
    recs.push({
      category: SCORE_CATEGORIES.CODE.key,
      priority: PRIORITY.HIGH,
      title: 'Add code examples to content-heavy pages',
      description:
        'More than half of pages have no code examples. AI agents use code to understand how APIs actually work — prose alone is not enough.',
      example: `Pages missing code:\n  - ${examples}\n\nAdd at minimum one complete, runnable example per conceptual page.`,
    });
  }

  // Short/fragment-only examples
  const completeExamples = allBlocks.filter((b) => b.code.split('\n').length >= 5);
  if (allBlocks.length > 0 && completeExamples.length / allBlocks.length < 0.2) {
    recs.push({
      category: SCORE_CATEGORIES.CODE.key,
      priority: PRIORITY.MEDIUM,
      title: 'Add complete, runnable code examples alongside snippets',
      description:
        'Most code examples are short fragments. AI agents need complete, runnable examples they can copy-paste without guessing missing imports or context.',
      example:
        "// Instead of just:\nauthClient.login(token)\n\n// Add a complete example:\nimport { AuthClient } from '@mylib/auth';\n\nconst client = new AuthClient({ baseUrl: 'https://api.example.com' });\nawait client.login({ token: process.env.API_TOKEN });\nconsole.log('Logged in!');",
    });
  }

  return recs;
}

// ─── Query recommendations ────────────────────────────────────────────────────

function queryRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const { pages } = crawl;
  const { score } = scores.query;

  // Missing quickstart
  const quickstartKw = [
    'getting-started',
    'quickstart',
    'quick-start',
    'introduction',
    'installation',
  ];
  const hasQuickstart = pages.some((p) =>
    quickstartKw.some(
      (kw) => p.url.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw),
    ),
  );
  if (!hasQuickstart) {
    recs.push({
      category: SCORE_CATEGORIES.QUERY.key,
      priority: PRIORITY.HIGH,
      title: 'Add a Getting Started / Quickstart guide',
      description:
        'Every AI agent that encounters your docs will look for a quickstart. Without one, agents spend tokens searching before they can help users get up and running.',
      example:
        "Create /docs/quickstart:\n# Quickstart\nGet up and running in under 5 minutes.\n\n## 1. Install\n```bash\nnpm install my-sdk\n```\n\n## 2. Initialize\n```js\nimport MySDK from 'my-sdk';\nconst sdk = new MySDK({ apiKey: 'YOUR_KEY' });\n```\n\n## 3. Make your first request\n...",
    });
  }

  // Missing API reference
  const apiKw = ['api-reference', 'api reference', 'api/reference', 'reference'];
  const hasApiRef = pages.some((p) =>
    apiKw.some((kw) => p.url.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw)),
  );
  if (!hasApiRef) {
    recs.push({
      category: SCORE_CATEGORIES.QUERY.key,
      priority: priorityFromScore(score),
      title: 'Add a dedicated API Reference section',
      description:
        'AI coding assistants constantly look up API signatures. A structured reference section with every method, parameter, and return type dramatically improves AI usefulness.',
      example:
        'Create /docs/api-reference/:\n\n## `sdk.connect(options)`\nEstablishes a connection to the service.\n\n**Parameters**\n| Name | Type | Required | Default | Description |\n|------|------|----------|---------|-------------|\n| options.host | string | Yes | — | Server host |\n| options.port | number | No | 443 | Server port |\n\n**Returns:** `Promise<Connection>`',
    });
  }

  // Thin pages
  const thinPages = pages.filter((p) => p.textContent.split(/\s+/).length < 100);
  if (thinPages.length > pages.length * 0.3) {
    const examples = thinPages
      .slice(0, 3)
      .map((p) => `${p.url} (~${p.textContent.split(/\s+/).length} words)`)
      .join('\n  - ');
    recs.push({
      category: SCORE_CATEGORIES.QUERY.key,
      priority: PRIORITY.MEDIUM,
      title: 'Expand thin pages to be self-contained',
      description: `${thinPages.length} pages have fewer than 100 words. AI agents need enough context on each page to answer questions without crawling multiple pages.`,
      example: `Thin pages:\n  - ${examples}\n\nEach page should answer: What is this? Why use it? How do I use it? What are the edge cases?`,
    });
  }

  // No summaries
  const summaryKw = ['summary', 'tldr', 'overview', 'in this guide', 'in this article'];
  const pagesWithSummary = pages.filter(
    (p) =>
      summaryKw.some((kw) => p.textContent.toLowerCase().slice(0, 500).includes(kw)) ||
      p.headings.some((h) => summaryKw.some((kw) => h.text.toLowerCase().includes(kw))),
  );
  if (pagesWithSummary.length < pages.length * 0.2) {
    recs.push({
      category: SCORE_CATEGORIES.QUERY.key,
      priority: PRIORITY.LOW,
      title: 'Add "In this guide" summaries to long pages',
      description:
        'Summaries at the top of pages help AI agents quickly determine page relevance before deep-reading. This saves tokens and improves answer accuracy.',
      example:
        "## In this guide\nYou'll learn how to:\n- Authenticate with the API\n- Make your first request\n- Handle errors and retries\n\n*Estimated reading time: 5 minutes*",
    });
  }

  return recs;
}

// ─── SEO-for-AI recommendations ───────────────────────────────────────────────

function seoForAiRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const { score } = scores.seoForAi;

  if (!crawl.hasLlmsTxt) {
    recs.push({
      category: SCORE_CATEGORIES.SEO.key,
      priority: PRIORITY.HIGH,
      title: 'Add /llms.txt to your docs root',
      description:
        "llms.txt is emerging as the standard for helping AI models navigate documentation. It's a simple markdown file at your root URL. Without it, AI agents must crawl blindly.",
      example:
        'Create https://yourdocs.com/llms.txt:\n\n# MyProduct\n\n> One-sentence description of what MyProduct does.\n\n## Docs\n\n- [Getting Started](/docs/quickstart): Install and make your first request\n- [API Reference](/docs/api): Full method reference\n- [Authentication](/docs/auth): How to authenticate requests',
    });
  }

  if (!crawl.hasLlmsFullTxt) {
    recs.push({
      category: SCORE_CATEGORIES.SEO.key,
      priority: priorityFromScore(score),
      title: 'Add /llms-full.txt with concatenated doc content',
      description:
        'llms-full.txt contains all documentation in a single file, allowing AI agents to load everything in one context window. Essential for complex, multi-step queries.',
      example:
        'Generate /llms-full.txt by concatenating all doc pages as markdown:\n\n# MyProduct Documentation\n\n---\n\n## Getting Started\n[full page content...]\n\n---\n\n## API Reference\n[full page content...]',
    });
  }

  const mdPages = crawl.pages.filter((p) => p.hasMarkdownVersion);
  if (mdPages.length === 0) {
    recs.push({
      category: SCORE_CATEGORIES.SEO.key,
      priority: PRIORITY.MEDIUM,
      title: 'Serve pages as .md alongside HTML',
      description:
        "When a page is available at both /docs/auth (HTML) and /docs/auth.md (Markdown), AI agents prefer the markdown version. It's cleaner, token-efficient, and structure-preserving.",
      example:
        "In Next.js, add an API route at /docs/[...slug].md.ts that returns the page content as clean markdown:\n\nexport async function GET(req) {\n  const content = await getMarkdownContent(slug);\n  return new Response(content, { headers: { 'Content-Type': 'text/markdown' } });\n}",
    });
  }

  if (!crawl.hasSitemap) {
    recs.push({
      category: SCORE_CATEGORIES.SEO.key,
      priority: PRIORITY.LOW,
      title: 'Add sitemap.xml to help crawlers discover all pages',
      description:
        'A sitemap.xml lets AI tools and search engines discover every page systematically without following every link. Many frameworks generate this automatically.',
      example:
        "In Next.js 13+, add app/sitemap.ts:\n\nexport default function sitemap() {\n  return [\n    { url: 'https://docs.example.com', lastModified: new Date() },\n    { url: 'https://docs.example.com/quickstart', lastModified: new Date() },\n    // ...\n  ];\n}",
    });
  }

  return recs;
}

// ─── Freshness recommendations ────────────────────────────────────────────────

function freshnessRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const { pages } = crawl;

  // Last-modified headers
  const pagesWithLm = pages.filter((p) => p.lastModified !== null);
  if (pagesWithLm.length < pages.length * 0.5) {
    recs.push({
      category: SCORE_CATEGORIES.FRESHNESS.key,
      priority: PRIORITY.MEDIUM,
      title: 'Add Last-Modified headers to documentation pages',
      description:
        'Last-Modified HTTP headers tell AI agents how current the information is. Stale docs without dates cause AI to use outdated information confidently.',
      example:
        "In Next.js, set headers in next.config.js:\n\nheaders: async () => [{\n  source: '/docs/:path*',\n  headers: [{ key: 'Last-Modified', value: new Date().toUTCString() }]\n}]",
    });
  }

  // No changelog
  const changelogKw = ['changelog', 'release-notes', 'releases', "what's-new"];
  const hasChangelog = pages.some((p) =>
    changelogKw.some(
      (kw) => p.url.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw),
    ),
  );
  if (!hasChangelog) {
    recs.push({
      category: SCORE_CATEGORIES.FRESHNESS.key,
      priority: PRIORITY.MEDIUM,
      title: 'Add a changelog or release notes page',
      description:
        "AI agents use changelogs to determine what's changed between versions. Without one, agents can't tell users about deprecations, breaking changes, or new features.",
      example:
        'Create /docs/changelog:\n\n# Changelog\n\n## v2.1.0 — 2025-02-15\n### Added\n- New `stream()` method for real-time responses\n\n### Changed\n- `connect()` now returns a typed `Connection` object\n\n### Deprecated\n- `v1/auth` endpoint — migrate to `v2/auth` by June 2025',
    });
  }

  // Broken links
  if (crawl.errors.length > 0) {
    const errorList = crawl.errors
      .slice(0, 5)
      .map((e) => `  - ${e.url}: ${e.error}`)
      .join('\n');
    recs.push({
      category: SCORE_CATEGORIES.FRESHNESS.key,
      priority: crawl.errors.length > 5 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
      title: `Fix ${crawl.errors.length} broken link(s) found during crawl`,
      description:
        'Broken links signal outdated docs to AI agents and undermine trust. When an AI follows a broken link, it may hallucinate the missing content.',
      example: `Broken URLs detected:\n${errorList}\n\nRun a link checker (e.g., \`npx linkinator https://yourdocs.com\`) regularly in CI.`,
    });
  }

  // No RSS feed
  if (!crawl.hasRssFeed) {
    recs.push({
      category: SCORE_CATEGORIES.FRESHNESS.key,
      priority: PRIORITY.LOW,
      title: 'Add an RSS feed for documentation updates',
      description:
        'An RSS feed at /feed.xml lets AI systems and developers subscribe to documentation changes. It signals an actively maintained project.',
      example:
        'Add a minimal RSS feed at /feed.xml:\n\n<?xml version="1.0"?>\n<rss version="2.0">\n  <channel>\n    <title>MyProduct Docs</title>\n    <link>https://docs.example.com</link>\n    <item>\n      <title>v2.1.0 released</title>\n      <pubDate>Mon, 17 Feb 2025 00:00:00 GMT</pubDate>\n    </item>\n  </channel>\n</rss>',
    });
  }

  return recs;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateRecommendations(scores: ScoreResult, crawl: CrawlResult): Recommendation[] {
  const allRecs: Recommendation[] = [];

  allRecs.push(...structureRecommendations(scores, crawl));
  allRecs.push(...codeRecommendations(scores, crawl));
  allRecs.push(...queryRecommendations(scores, crawl));
  allRecs.push(...seoForAiRecommendations(scores, crawl));
  allRecs.push(...freshnessRecommendations(scores, crawl));

  // Filter to only return recs for categories that scored below 15,
  // but keep 'high' priority ones regardless.
  const filtered = allRecs.filter((rec) => {
    const categoryScore = scores[rec.category].score;
    return categoryScore < 15 || rec.priority === PRIORITY.HIGH;
  });

  // Sort by priority: high first, then medium, then low.
  const priorityOrder: Record<Priority, number> = {
    [PRIORITY.HIGH]: 0,
    [PRIORITY.MEDIUM]: 1,
    [PRIORITY.LOW]: 2,
  };
  filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return filtered;
}
