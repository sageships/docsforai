import type { CrawlResult, CrawledPage } from './crawler';

export interface LlmsTxtOutput {
  llmsTxt: string;
  llmsFullTxt: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function extractProductName(pages: CrawledPage[]): string {
  if (pages.length === 0) return 'Documentation';

  const firstPage = pages[0];

  // Try OG site_name first (most reliable)
  // We don't have it directly but can infer from title patterns like "Page | Product"
  const title = firstPage.title;
  const separators = [' | ', ' - ', ' – ', ' · ', ' :: '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      // Usually the product name is the last segment
      const candidate = parts[parts.length - 1].trim();
      if (candidate && candidate.length > 1 && candidate.length < 60) {
        return candidate;
      }
    }
  }

  // Fall back to first h1 on the root page
  const h1 = firstPage.headings.find((h) => h.level === 1);
  if (h1) return h1.text.trim();

  return title.trim() || 'Documentation';
}

function extractDescription(page: CrawledPage): string {
  // Use meta description if available
  if (page.metaDescription && page.metaDescription.length > 10) {
    return page.metaDescription.trim();
  }

  // Use first substantial paragraph from text content
  const sentences = page.textContent
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 30)
    .slice(0, 2);

  if (sentences.length > 0) {
    return sentences.join(' ').trim().slice(0, 200);
  }

  return 'Developer documentation';
}

function getBriefDescription(page: CrawledPage): string {
  if (page.metaDescription && page.metaDescription.length > 10) {
    return page.metaDescription.trim().slice(0, 120);
  }

  // Use first heading after h1 as a hint
  const subHeading = page.headings.find((h) => h.level === 2);
  if (subHeading) {
    return subHeading.text.trim().slice(0, 120);
  }

  // Fallback: first 120 chars of text
  return page.textContent.trim().slice(0, 120).replace(/\s+/g, ' ');
}

function pageToMarkdown(page: CrawledPage): string {
  const lines: string[] = [];

  // Title as h1
  lines.push(`# ${page.title}`);
  lines.push(`> Source: ${page.url}`);
  lines.push('');

  if (page.metaDescription) {
    lines.push(`*${page.metaDescription}*`);
    lines.push('');
  }

  // Text content as body
  // We don't have the full parsed HTML here, just textContent and headings.
  // Reconstruct a readable structure by interleaving headings with text chunks.
  lines.push(page.textContent);
  lines.push('');

  // Code blocks
  if (page.codeBlocks.filter((c) => !c.isInline).length > 0) {
    lines.push('## Code Examples');
    lines.push('');
    for (const block of page.codeBlocks.filter((c) => !c.isInline)) {
      const lang = block.language ?? '';
      lines.push('```' + lang);
      lines.push(block.code);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function isLikelyDocPage(page: CrawledPage, rootUrl: string): boolean {
  // Skip error pages
  if (page.statusCode >= 400) return false;

  const docPatterns = [
    /\/docs\//i,
    /\/documentation\//i,
    /\/guide\//i,
    /\/guides\//i,
    /\/reference\//i,
    /\/api\//i,
    /\/learn\//i,
    /\/tutorial/i,
    /\/getting-started/i,
    /\/quickstart/i,
    /\/manual\//i,
  ];

  const isDoc = docPatterns.some((p) => p.test(page.url));
  const isRoot = page.url === rootUrl || page.url === rootUrl + '/';

  return isDoc || isRoot || page.headings.length >= 2;
}

function sortPages(pages: CrawledPage[], rootUrl: string): CrawledPage[] {
  return [...pages].sort((a, b) => {
    // Root page first
    if (a.url === rootUrl) return -1;
    if (b.url === rootUrl) return 1;

    // Quickstart / getting-started pages second
    const quickstartKw = ['getting-started', 'quickstart', 'introduction', 'overview'];
    const aIsQuick = quickstartKw.some((kw) => a.url.toLowerCase().includes(kw));
    const bIsQuick = quickstartKw.some((kw) => b.url.toLowerCase().includes(kw));
    if (aIsQuick && !bIsQuick) return -1;
    if (bIsQuick && !aIsQuick) return 1;

    // Alphabetical by URL otherwise
    return a.url.localeCompare(b.url);
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateLlmsTxt(crawl: CrawlResult): LlmsTxtOutput {
  const { pages, rootUrl } = crawl;

  if (pages.length === 0) {
    return {
      llmsTxt: '# Documentation\n\n> No pages could be crawled.\n',
      llmsFullTxt: '',
    };
  }

  const docPages = pages.filter((p) => isLikelyDocPage(p, rootUrl));
  const sorted = sortPages(docPages.length > 0 ? docPages : pages, rootUrl);

  const productName = extractProductName(sorted);
  const rootPage = sorted.find((p) => p.url === rootUrl) ?? sorted[0];
  const description = extractDescription(rootPage);

  // ─── llms.txt ────────────────────────────────────────────────────────────

  const llmsTxtLines: string[] = [`# ${productName}`, '', `> ${description}`, '', '## Docs', ''];

  for (const page of sorted) {
    const brief = getBriefDescription(page);
    llmsTxtLines.push(`- [${page.title}](${page.url}): ${brief}`);
  }

  // Optional sections
  if (crawl.hasLlmsFullTxt) {
    llmsTxtLines.push('');
    llmsTxtLines.push('## Full Text');
    llmsTxtLines.push('');
    llmsTxtLines.push(`- [Full documentation text](${rootUrl}/llms-full.txt)`);
  }

  if (crawl.hasSitemap) {
    llmsTxtLines.push('');
    llmsTxtLines.push('## Sitemap');
    llmsTxtLines.push('');
    llmsTxtLines.push(`- [sitemap.xml](${rootUrl}/sitemap.xml)`);
  }

  const llmsTxt = llmsTxtLines.join('\n') + '\n';

  // ─── llms-full.txt ───────────────────────────────────────────────────────

  const llmsFullParts: string[] = [
    `# ${productName} — Full Documentation`,
    '',
    `> ${description}`,
    '',
    `Source: ${rootUrl}`,
    '',
    '---',
    '',
  ];

  for (const page of sorted) {
    llmsFullParts.push(pageToMarkdown(page));
    llmsFullParts.push('---');
    llmsFullParts.push('');
  }

  const llmsFullTxt = llmsFullParts.join('\n');

  return { llmsTxt, llmsFullTxt };
}
