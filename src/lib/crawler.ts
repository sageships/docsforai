import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface Heading {
  level: number;
  text: string;
}

export interface CodeBlock {
  language: string | null;
  code: string;
  isInline: boolean;
  hasCopyButton: boolean;
}

export interface CrawledPage {
  url: string;
  title: string;
  headings: Heading[];
  codeBlocks: CodeBlock[];
  textContent: string;
  links: string[];
  hasMarkdownVersion: boolean;
  statusCode: number;
  lastModified: string | null;
  metaDescription: string | null;
  hasOpenGraph: boolean;
  hasTables: boolean;
  hasBulletLists: boolean;
  hasNumberedLists: boolean;
}

export interface CrawlResult {
  rootUrl: string;
  pages: CrawledPage[];
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
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_PAGES = 50;

function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolved = new URL(url, base);
    // Strip hash
    resolved.hash = '';
    return resolved.href;
  } catch {
    return null;
  }
}

function isSameDomain(url: string, rootUrl: string): boolean {
  try {
    const u = new URL(url);
    const r = new URL(rootUrl);
    return u.hostname === r.hostname;
  } catch {
    return false;
  }
}

function isDocUrl(url: string): boolean {
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
  return docPatterns.some((p) => p.test(url));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url: string): Promise<{ exists: boolean; statusCode: number }> {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, 5000);
    return { exists: res.ok, statusCode: res.status };
  } catch {
    return { exists: false, statusCode: 0 };
  }
}

async function parseRobotsTxt(rootUrl: string): Promise<Set<string>> {
  const disallowed = new Set<string>();
  try {
    const robotsUrl = new URL('/robots.txt', rootUrl).href;
    const res = await fetchWithTimeout(robotsUrl, {}, 5000);
    if (!res.ok) return disallowed;
    const text = await res.text();
    let inUserAgentAll = false;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1].trim();
        inUserAgentAll = agent === '*';
      } else if (inUserAgentAll && trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.split(':')[1].trim();
        if (path) disallowed.add(path);
      }
    }
  } catch {
    // ignore
  }
  return disallowed;
}

function isDisallowed(url: string, disallowedPaths: Set<string>): boolean {
  try {
    const { pathname } = new URL(url);
    for (const disallowed of disallowedPaths) {
      if (pathname.startsWith(disallowed)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function parsePage(
  url: string,
  html: string,
  statusCode: number,
  lastModified: string | null,
): CrawledPage {
  const $ = cheerio.load(html);

  // Title
  const title = $('head title').first().text().trim() || $('h1').first().text().trim() || url;

  // Meta description
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;

  // OpenGraph
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;

  // Headings
  const headings: Heading[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as Element).tagName.toLowerCase();
    const level = parseInt(tag.replace('h', ''), 10);
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  // Code blocks
  const codeBlocks: CodeBlock[] = [];

  // Block code: <pre><code> or <pre>
  $('pre').each((_, el) => {
    const codeEl = $(el).find('code').first();
    const rawCode = codeEl.length ? codeEl.text() : $(el).text();
    const code = rawCode.trim();
    if (!code) return;

    // Detect language from class
    const classAttr = codeEl.attr('class') || $(el).attr('class') || '';
    const langMatch = classAttr.match(/(?:language|lang)-([a-zA-Z0-9+#]+)/);
    const language = langMatch ? langMatch[1] : null;

    // Detect copy button nearby
    const parent = $(el).parent();
    const hasCopyButton =
      parent.find('button').length > 0 ||
      $(el).siblings('button').length > 0 ||
      $(el).find('button').length > 0;

    codeBlocks.push({ language, code, isInline: false, hasCopyButton });
  });

  // Inline code
  $('code').each((_, el) => {
    // Skip if inside <pre>
    if ($(el).parents('pre').length > 0) return;
    const code = $(el).text().trim();
    if (!code) return;
    codeBlocks.push({ language: null, code, isInline: true, hasCopyButton: false });
  });

  // Lists
  const hasBulletLists = $('ul li').length > 0;
  const hasNumberedLists = $('ol li').length > 0;
  const hasTables = $('table').length > 0;

  // Text content (remove scripts, styles, nav)
  $('script, style, nav, header, footer, aside').remove();
  const textContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  // Links
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, url);
    if (normalized) links.push(normalized);
  });

  return {
    url,
    title,
    headings,
    codeBlocks,
    textContent,
    links: [...new Set(links)],
    hasMarkdownVersion: false, // filled in later
    statusCode,
    lastModified,
    metaDescription,
    hasOpenGraph,
    hasTables,
    hasBulletLists,
    hasNumberedLists,
  };
}

export async function crawlDocs(startUrl: string): Promise<CrawlResult> {
  const rootUrl = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: CrawledPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  // Parse robots.txt first
  const disallowedPaths = await parseRobotsTxt(rootUrl);

  // Check for special files in parallel
  const [llmsTxtResult, llmsFullTxtResult, sitemapResult, rssResult] = await Promise.all([
    checkUrl(new URL('/llms.txt', rootUrl).href),
    checkUrl(new URL('/llms-full.txt', rootUrl).href),
    checkUrl(new URL('/sitemap.xml', rootUrl).href),
    checkUrl(new URL('/feed.xml', rootUrl).href).then(async (r) => {
      if (r.exists) return r;
      return checkUrl(new URL('/rss.xml', rootUrl).href);
    }),
  ]);

  const hasLlmsTxt = llmsTxtResult.exists;
  const hasLlmsFullTxt = llmsFullTxtResult.exists;
  const hasSitemap = sitemapResult.exists;
  const hasRssFeed = rssResult.exists;

  // Detect docs structure from first page
  let docsStructure = {
    hasSidebar: false,
    hasNavigation: false,
    hasVersioning: false,
    hasSearch: false,
  };

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    // Skip disallowed paths
    if (isDisallowed(url, disallowedPaths)) continue;

    // Skip non-HTML resources
    if (/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|gz)(\?.*)?$/i.test(url)) {
      continue;
    }

    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'DocsForAI-Crawler/1.0 (https://docsforai.com; scanning for AI readiness)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      const statusCode = res.status;
      const lastModified = res.headers.get('last-modified');
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('text/html')) continue;
      if (!res.ok) {
        errors.push({ url, error: `HTTP ${statusCode}` });
        continue;
      }

      const html = await res.text();
      const page = parsePage(url, html, statusCode, lastModified);

      // Check for markdown version
      const mdUrl = url.replace(/\/$/, '') + '.md';
      const mdCheck = await checkUrl(mdUrl);
      page.hasMarkdownVersion = mdCheck.exists;

      // Detect docs structure from first fully parsed page
      if (pages.length === 0) {
        const $ = cheerio.load(html);
        docsStructure = {
          hasSidebar:
            $('aside, [class*="sidebar"], [class*="side-bar"], nav[class*="doc"]').length > 0,
          hasNavigation:
            $('nav, [role="navigation"], [class*="navbar"], [class*="nav-bar"]').length > 0,
          hasVersioning:
            $('[class*="version"], select option[value*="v"], [class*="versions"]').length > 0 ||
            /v\d+\.\d+/i.test($('nav, header, aside').text()),
          hasSearch: $('input[type="search"], [class*="search"], [role="search"]').length > 0,
        };
      }

      pages.push(page);

      // Enqueue discovered links
      for (const link of page.links) {
        if (!visited.has(link) && isSameDomain(link, rootUrl)) {
          // Prioritise likely doc pages
          if (isDocUrl(link) || isSameDomain(link, startUrl)) {
            queue.unshift(link);
          } else {
            queue.push(link);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ url, error: message });
    }
  }

  return {
    rootUrl,
    pages,
    hasLlmsTxt,
    hasLlmsFullTxt,
    hasSitemap,
    hasRssFeed,
    docsStructure,
    errors,
  };
}
