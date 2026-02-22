import { z } from 'zod';

/**
 * Zod schemas for API request/response validation.
 * Import these in route handlers to parse (not just validate) inputs.
 *
 * Pattern: use `.parse()` to throw on invalid input, or `.safeParse()` to
 * handle errors gracefully.
 */

// ─── Shared ──────────────────────────────────────────────────────────────────

/** A valid, publicly-routable HTTP/HTTPS URL. */
export const PublicUrlSchema = z
  .string()
  .min(1, 'URL is required')
  .url('Must be a valid URL')
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'URL must use http or https protocol',
  );

// ─── POST /api/scan ───────────────────────────────────────────────────────────

export const ScanRequestSchema = z.object({
  url: PublicUrlSchema,
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

// ─── POST /api/generate-llmstxt ──────────────────────────────────────────────

export const GenerateLlmsTxtRequestSchema = z
  .object({
    url: PublicUrlSchema.optional(),
    scanId: z.string().min(1, 'scanId must be a non-empty string').optional(),
  })
  .refine((data) => data.url !== undefined || data.scanId !== undefined, {
    message: 'Either url or scanId is required',
  });

export type GenerateLlmsTxtRequest = z.infer<typeof GenerateLlmsTxtRequestSchema>;

// ─── Environment ──────────────────────────────────────────────────────────────

export const EnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;
