import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import {
  CRAWLER_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
  MAX_PAGES,
  MAX_TEXT_CONTENT_CHARS,
  QUICK_CHECK_TIMEOUT_MS,
} from './constants';

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
  isSpa: boolean;
  spaNote?: string;
  docsStructure: {
    hasSidebar: boolean;
    hasNavigation: boolean;
    hasVersioning: boolean;
    hasSearch: boolean;
  };
  errors: Array<{ url: string; error: string }>;
}

/** Number of URLs to fetch concurrently during crawl. */
const CRAWL_CONCURRENCY = 5;

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

/**
 * Check if a URL is within the same base path as the start URL.
 * e.g. startUrl = https://example.com/docs/v2/ → only follow links under /docs/v2/
 */
function isWithinBasePath(url: string, startUrl: string): boolean {
  try {
    const u = new URL(url);
    const s = new URL(startUrl);
    if (u.hostname !== s.hostname) return false;
    // Derive the "docs root" path — strip the last path segment if it looks like a page slug
    const basePath = s.pathname.replace(/\/[^/]+$/, '') || '/';
    return u.pathname.startsWith(basePath);
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

/**
 * Detect if a page appears to be a JavaScript SPA with no server-rendered content.
 * Returns true when the body has almost no text (all content is loaded via JS).
 */
function isSpaPage(html: string): boolean {
  const $ = cheerio.load(html);
  // Remove scripts and styles before checking text
  $('script, style').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  // If body text is very short, it's almost certainly an SPA shell
  return bodyText.length < 200;
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
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, QUICK_CHECK_TIMEOUT_MS);
    return { exists: res.ok, statusCode: res.status };
  } catch {
    return { exists: false, statusCode: 0 };
  }
}

async function parseRobotsTxt(rootUrl: string): Promise<Set<string>> {
  const disallowed = new Set<string>();
  try {
    const robotsUrl = new URL('/robots.txt', rootUrl).href;
    const res = await fetchWithTimeout(robotsUrl, {}, QUICK_CHECK_TIMEOUT_MS);
    if (!res.ok) return disallowed;
    const text = await res.text();
    let inUserAgentAll = false;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1]?.trim() ?? '';
        inUserAgentAll = agent === '*';
      } else if (inUserAgentAll && trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.split(':')[1]?.trim() ?? '';
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

/**
 * Fetch and parse a sitemap.xml, returning all discovered URLs.
 * Handles both standard sitemaps and sitemap index files (which reference other sitemaps).
 * Filters results to only include URLs within the same domain as rootUrl.
 */
async function fetchSitemapUrls(rootUrl: string, startUrl: string): Promise<string[]> {
  const urls: string[] = [];

  async function parseSingleSitemap(sitemapUrl: string, depth = 0): Promise<void> {
    if (depth > 2) return; // prevent infinite recursion
    try {
      const res = await fetchWithTimeout(sitemapUrl, {
        headers: { 'User-Agent': CRAWLER_USER_AGENT, Accept: 'application/xml, text/xml, */*' },
      }, DEFAULT_TIMEOUT_MS);
      if (!res.ok) return;

      const contentType = res.headers.get('content-type') || '';
      // If server returns HTML instead of XML, it's an SPA shell — bail
      if (contentType.includes('text/html')) return;

      const text = await res.text();
      if (!text.trim().startsWith('<')) return; // Not XML

      const $ = cheerio.load(text, { xmlMode: true });

      // Sitemap index — contains references to other sitemaps
      const sitemapRefs = $('sitemapindex > sitemap > loc');
      if (sitemapRefs.length > 0) {
        const subSitemaps: string[] = [];
        sitemapRefs.each((_, el) => {
          const loc = $(el).text().trim();
          if (loc) subSitemaps.push(loc);
        });
        // Parse sub-sitemaps in parallel (limit to first 5 to avoid overload)
        await Promise.all(subSitemaps.slice(0, 5).map((u) => parseSingleSitemap(u, depth + 1)));
        return;
      }

      // Regular sitemap — contains <url><loc>...</loc></url> entries
      $('urlset > url > loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (loc && isSameDomain(loc, rootUrl)) {
          urls.push(loc);
        }
      });

      // Some sitemaps use just <loc> at the top level
      if (urls.length === 0) {
        $('loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (loc && isSameDomain(loc, rootUrl)) {
            urls.push(loc);
          }
        });
      }
    } catch {
      // ignore sitemap fetch errors
    }
  }

  // Try the standard sitemap location
  await parseSingleSitemap(new URL('/sitemap.xml', rootUrl).href);

  // Also try sitemap_index.xml and sitemap/sitemap.xml
  if (urls.length === 0) {
    await parseSingleSitemap(new URL('/sitemap_index.xml', rootUrl).href);
  }
  if (urls.length === 0) {
    await parseSingleSitemap(new URL('/sitemap/sitemap.xml', rootUrl).href);
  }

  // Deduplicate and filter to same domain
  return [...new Set(urls)].filter((u) => isSameDomain(u, rootUrl));
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

  // ─── IMPORTANT: Extract links BEFORE removing nav/aside elements ────────────
  // Many documentation sites embed their sidebar navigation inside <nav> and
  // <aside> elements. If we remove those BEFORE extracting links, the crawler
  // loses all the sidebar links needed to discover sub-pages.
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    // Skip javascript: and mailto: links
    if (href.startsWith('javascript:') || href.startsWith('mailto:')) return;
    const normalized = normalizeUrl(href, url);
    if (normalized) links.push(normalized);
  });

  // Text content — NOW safe to remove nav/aside for clean text extraction
  $('script, style, nav, header, footer, aside').remove();
  const textContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CONTENT_CHARS);

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

/** Fetch and parse a single URL. Returns null if the page should be skipped. */
async function processUrl(
  url: string,
  pages: CrawledPage[],
  errors: Array<{ url: string; error: string }>,
  docsStructureRef: { value: CrawlResult['docsStructure'] | null },
): Promise<CrawledPage | null> {
  // Skip non-HTML resources
  if (/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|gz)(\?.*)?$/i.test(url)) {
    return null;
  }

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': CRAWLER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const statusCode = res.status;
    const lastModified = res.headers.get('last-modified');
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) return null;
    if (!res.ok) {
      errors.push({ url, error: `HTTP ${statusCode}` });
      return null;
    }

    const html = await res.text();
    const page = parsePage(url, html, statusCode, lastModified);

    // Check for markdown version
    const mdUrl = url.replace(/\/$/, '') + '.md';
    const mdCheck = await checkUrl(mdUrl);
    page.hasMarkdownVersion = mdCheck.exists;

    // Detect docs structure from first fully parsed page
    if (pages.length === 0 && docsStructureRef.value === null) {
      const $ = cheerio.load(html);
      docsStructureRef.value = {
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

    return page;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push({ url, error: message });
    return null;
  }
}

export async function crawlDocs(startUrl: string): Promise<CrawlResult> {
  const rootUrl = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: CrawledPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const docsStructureRef: { value: CrawlResult['docsStructure'] | null } = { value: null };

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

  // ── SPA detection: check if the start page is JS-rendered ──────────────────
  // We do a quick fetch of the start URL to detect if the site is SPA-based.
  // If so, we rely on the sitemap to discover pages instead of HTML link following.
  let isSpa = false;
  let spaNote: string | undefined;

  try {
    const probeRes = await fetchWithTimeout(startUrl, {
      headers: { 'User-Agent': CRAWLER_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    }, DEFAULT_TIMEOUT_MS);
    if (probeRes.ok) {
      const probeHtml = await probeRes.text();
      if (isSpaPage(probeHtml)) {
        isSpa = true;
        spaNote =
          'This documentation site appears to be a JavaScript-rendered SPA (Single Page Application). ' +
          'The crawler cannot follow links discovered through JavaScript execution. ' +
          'Attempting URL discovery via sitemap.xml and other static sources.';
        console.log(`[crawler] SPA detected at ${startUrl} — switching to sitemap-based discovery`);
      }
    }
  } catch {
    // ignore probe errors
  }

  // ── Seed queue from sitemap (essential for SPA sites, beneficial for all) ──
  // Always attempt sitemap-based URL discovery. For SPA sites this is the
  // primary crawl strategy. For static sites it supplements link following.
  const sitemapUrls = await fetchSitemapUrls(rootUrl, startUrl);
  if (sitemapUrls.length > 0) {
    console.log(`[crawler] Discovered ${sitemapUrls.length} URLs from sitemap`);
    // Prioritise URLs that look like docs pages; push others to the back
    for (const u of sitemapUrls) {
      if (!queue.includes(u)) {
        if (isDocUrl(u) || isWithinBasePath(u, startUrl)) {
          queue.unshift(u); // high priority
        } else {
          queue.push(u);
        }
      }
    }
  } else if (isSpa) {
    // SPA site with no sitemap — we can still crawl the pages we know about
    // by looking at any absolute URLs baked into the HTML (e.g. canonical tags)
    console.log(`[crawler] SPA with no sitemap — only crawling known entry URL`);
  }

  // Crawl in parallel batches
  while (queue.length > 0 && pages.length < MAX_PAGES) {
    // Build a batch of URLs to process concurrently
    const batch: string[] = [];
    while (
      batch.length < CRAWL_CONCURRENCY &&
      queue.length > 0 &&
      pages.length + batch.length < MAX_PAGES
    ) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      if (isDisallowed(url, disallowedPaths)) continue;
      visited.add(url);
      batch.push(url);
    }

    if (batch.length === 0) break;

    // Process the batch concurrently
    const results = await Promise.allSettled(
      batch.map((url) => processUrl(url, pages, errors, docsStructureRef)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        const page = result.value;
        pages.push(page);

        // Enqueue discovered links
        // For SPA sites: the links array from parsePage() will be mostly empty
        // (nothing to follow from JS-rendered pages). The sitemap already seeded
        // the queue above, so this is mostly a no-op for SPAs.
        for (const link of page.links) {
          if (!visited.has(link) && isSameDomain(link, rootUrl)) {
            // Prioritise likely doc pages or pages within the same docs path
            if (isDocUrl(link) || isWithinBasePath(link, startUrl)) {
              queue.unshift(link);
            } else {
              queue.push(link);
            }
          }
        }
      }
    }
  }

  const docsStructure = docsStructureRef.value ?? {
    hasSidebar: false,
    hasNavigation: false,
    hasVersioning: false,
    hasSearch: false,
  };

  return {
    rootUrl,
    pages,
    hasLlmsTxt,
    hasLlmsFullTxt,
    hasSitemap,
    hasRssFeed,
    isSpa,
    spaNote,
    docsStructure,
    errors,
  };
}
