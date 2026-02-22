/**
 * URL validation utilities with SSRF protection.
 * Blocks requests to private/internal IP ranges, localhost, and non-HTTP protocols.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', 'metadata.google.internal']);

const BLOCKED_IP_PATTERNS: RegExp[] = [
  /^127\./, // loopback
  /^10\./, // private class A
  /^172\.(1[6-9]|2\d|3[01])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local / AWS metadata endpoint
  /^100\.64\./, // CGNAT shared address space
];

const BLOCKED_IPv6_PATTERNS: RegExp[] = [
  /^::1$/, // IPv6 loopback
  /^::$/, // unspecified address
  /^fc[0-9a-f]{2}:/i, // unique local (fc00::/7)
  /^fd[0-9a-f]{2}:/i, // unique local (fd00::/8)
  /^fe80:/i, // link-local
];

/**
 * Returns true if the URL is safe to crawl (publicly routable http/https only).
 * Blocks:
 *   - Non-http/https protocols (file://, ftp://, etc.)
 *   - localhost and 0.0.0.0
 *   - Private IP ranges (10.x, 172.16-31.x, 192.168.x)
 *   - AWS metadata endpoint (169.254.169.254)
 *   - IPv6 loopback and private addresses
 */
export function isPublicUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known bad hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return false;
  }

  // Block IPv4 private/loopback ranges
  if (BLOCKED_IP_PATTERNS.some((p) => p.test(hostname))) {
    return false;
  }

  // Block IPv6 private/loopback addresses
  // Unwrap IPv6 brackets: [::1] → ::1
  const rawHostname = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  if (BLOCKED_IPv6_PATTERNS.some((p) => p.test(rawHostname))) {
    return false;
  }

  return true;
}
